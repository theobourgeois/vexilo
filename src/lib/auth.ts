import { getServerSession } from 'next-auth/next';

import { AuthOptions, DefaultSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { emailSchema } from '@/lib/auth-validation';
import { verifyPassword } from '@/lib/password';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';
import { db } from '@/db';
import { Adapter } from 'next-auth/adapters';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq, sql } from 'drizzle-orm';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      isAdmin: boolean;
      // ...other properties
      // role: UserRole;
    } & DefaultSession['user'];
  }
}

export const authOptions: AuthOptions = {
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Email and password',
      credentials: { email: { type: 'email' }, password: { type: 'password' } },
      async authorize(credentials, request) {
        const email = emailSchema.safeParse(credentials?.email);
        const password = credentials?.password;
        if (!email.success || !password || password.length > 128) return null;
        const forwarded = request.headers?.['x-forwarded-for'];
        const ip =
          (Array.isArray(forwarded) ? forwarded[0] : forwarded)
            ?.split(',')[0]
            ?.trim() || 'unknown';
        const allowed = await Promise.all([
          allowAuthAttempt('login-email', email.data, 10),
          allowAuthAttempt('login-ip', ip, 50),
        ]);
        if (allowed.some((value) => !value))
          throw new Error('Too many attempts. Try again in 15 minutes.');
        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            isAdmin: users.isAdmin,
            hashedPassword: users.hashedPassword,
            emailVerified: users.emailVerified,
          })
          .from(users)
          .where(sql`lower(${users.email}) = ${email.data}`)
          .limit(1);
        if (
          !(await verifyPassword(password, user?.hashedPassword ?? null)) ||
          !user
        )
          return null;
        if (!user.emailVerified) throw new Error('EmailNotVerified');
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google')
        return Boolean(
          profile &&
          'email_verified' in profile &&
          profile.email_verified === true,
        );
      return true;
    },
    async jwt({ token, user, trigger, account, profile }) {
      if (user) {
        if (
          account?.provider === 'google' &&
          profile &&
          'email_verified' in profile &&
          profile.email_verified === true
        ) {
          await db
            .update(users)
            .set({ emailVerified: new Date() })
            .where(eq(users.id, user.id));
        }
        token.id = user.id;
        token.name = user.name;
        // @ts-expect-error - this is a custom field
        token.isAdmin = user.isAdmin;
      }
      // The client calls `update()` after changing its name or picture; re-read
      // them so the session (and header avatar) reflect the change.
      if (trigger === 'update' && token.id) {
        const fresh = await db
          .select({ name: users.name, image: users.image })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1)
          .then((res) => res[0]);
        if (fresh) {
          token.name = fresh.name;
          token.picture = fresh.image;
        }
      }
      return token;
    },
    session: ({ session, token }) => {
      return {
        ...session,
        user: {
          ...session.user,
          isAdmin: token.isAdmin,
          id: token.id,
        },
      };
    },
  },
  session: {
    strategy: 'jwt',
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  secret: process.env.NEXTAUTH_SECRET!,
};

export const getServerAuthSession = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return session;
  // Recheck the database so sessions issued before email verification was
  // introduced cannot post or upload with an unverified password account.
  const [user] = await db
    .select({
      passwordAccount: sql<boolean>`${users.hashedPassword} is not null`,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user || (user.passwordAccount && !user.emailVerified)) return null;
  return session;
};
