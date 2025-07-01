import { getServerSession } from "next-auth/next";

import { AuthOptions, DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { db } from "@/db";
import { Adapter } from "next-auth/adapters";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      isAdmin: boolean;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }
}

export const authOptions: AuthOptions = {
  pages: {
    signIn: "/?signIn=true"
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token;
        token.id = user.id;
        token.name = user.name;
        // @ts-expect-error - this is a custom field
        token.isAdmin = user.isAdmin;
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
      }
    },
  },
  session: {
    strategy: "jwt",
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  secret: process.env.NEXTAUTH_SECRET!,
};

export const getServerAuthSession = () => getServerSession(authOptions)