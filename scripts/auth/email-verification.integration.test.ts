import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, mock, test } from 'node:test';
import { and, eq, inArray } from 'drizzle-orm';
import type { Pool } from 'pg';
import { db } from '@/db';
import { emailChallenges, users } from '@/db/schema';
import {
  beginEmailVerification,
  completeEmailVerification,
  resendEmailVerification,
} from '@/lib/email-verification';
import { hashPassword } from '@/lib/password';

const url = new URL(process.env.DATABASE_URL!);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.startsWith('/vexilo_verification_check_')
) {
  throw new Error(
    'Use an isolated local database named vexilo_verification_check_*',
  );
}
process.env.RESEND_API_KEY = 'test-only-key';
process.env.EMAIL_FROM = 'Vexilo <noreply@mail.example.test>';
process.env.NEXTAUTH_SECRET = 'verification-integration-test-secret';
const sent = new Map<string, string[]>();
const emails: string[] = [];
let failDelivery = false;
let hashedPassword: string;
const fresh = () => {
  const email = `verification-${randomUUID()}@example.test`;
  emails.push(email);
  return { email, name: 'New member', hashedPassword, userId: null };
};
const codeFor = (email: string) => sent.get(email)!.at(-1)!;

before(async () => {
  hashedPassword = await hashPassword('a long integration test password');
  mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(
        input,
        'https://api.resend.com/emails',
        'No external requests are allowed by these tests',
      );
      if (failDelivery) return new Response('{}', { status: 403 });
      const message = JSON.parse(String(init?.body));
      const email = message.to[0];
      const code = message.text.match(/code is: (\d{6})/)?.[1];
      assert.ok(code);
      sent.set(email, [...(sent.get(email) ?? []), code]);
      return new Response(JSON.stringify({ id: randomUUID() }), {
        status: 200,
      });
    },
  );
});

after(async () => {
  if (emails.length) {
    await db
      .delete(emailChallenges)
      .where(inArray(emailChallenges.email, emails));
    await db.delete(users).where(inArray(users.email, emails));
  }
  mock.restoreAll();
  await (db.$client as unknown as Pool).end();
});

test('a signup creates no user until the correct code is consumed, then cannot be replayed', async () => {
  const details = fresh();
  const ip = randomUUID();
  const result = await beginEmailVerification(details, ip);
  assert.equal(result.success, true);
  assert.ok(result.pending);
  assert.equal(
    (await db.select().from(users).where(eq(users.email, details.email)))
      .length,
    0,
  );
  const [stored] = await db
    .select()
    .from(emailChallenges)
    .where(eq(emailChallenges.email, details.email));
  assert.notEqual(stored.codeHash, codeFor(details.email));
  assert.equal(JSON.stringify(result).includes(hashedPassword), false);
  const wrong = codeFor(details.email) === '000000' ? '000001' : '000000';
  assert.equal(
    (
      await completeEmailVerification(
        details.email,
        result.pending.id,
        wrong,
        ip,
      )
    ).success,
    false,
  );
  assert.equal(
    (
      await completeEmailVerification(
        details.email,
        result.pending.id,
        codeFor(details.email),
        ip,
      )
    ).success,
    true,
  );
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, details.email));
  assert.ok(user.emailVerified);
  assert.equal(user.isAdmin, false);
  assert.equal(user.hashedPassword, hashedPassword);
  assert.equal(
    (
      await completeEmailVerification(
        details.email,
        result.pending.id,
        codeFor(details.email),
        ip,
      )
    ).success,
    false,
  );
});

test('expired codes fail; resend has a cooldown and invalidates the previous challenge', async () => {
  const details = fresh();
  const ip = randomUUID();
  const result = await beginEmailVerification(details, ip);
  const original = result.pending!;
  assert.equal(
    (await resendEmailVerification(details.email, original.id, ip)).success,
    false,
  );
  await db
    .update(emailChallenges)
    .set({
      expiresAt: new Date(Date.now() - 1000),
      sentAt: new Date(Date.now() - 61_000),
    })
    .where(eq(emailChallenges.email, details.email));
  assert.equal(
    (
      await completeEmailVerification(
        details.email,
        original.id,
        codeFor(details.email),
        ip,
      )
    ).success,
    false,
  );
  const resent = await resendEmailVerification(details.email, original.id, ip);
  assert.equal(resent.success, true);
  assert.ok('pending' in resent && resent.pending);
  if (!('pending' in resent) || !resent.pending) return;
  assert.notEqual(resent.pending.id, original.id);
  assert.equal(
    (
      await completeEmailVerification(
        details.email,
        original.id,
        codeFor(details.email),
        ip,
      )
    ).success,
    false,
  );
  assert.equal(
    (
      await completeEmailVerification(
        details.email,
        resent.pending.id,
        codeFor(details.email),
        ip,
      )
    ).success,
    true,
  );
});

test('five wrong guesses exhaust a challenge, including a later correct guess', async () => {
  const details = fresh();
  const ip = randomUUID();
  const result = await beginEmailVerification(details, ip);
  const wrong = codeFor(details.email) === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await completeEmailVerification(
          details.email,
          result.pending!.id,
          wrong,
          ip,
        )
      ).success,
      false,
    );
  assert.equal(
    (
      await completeEmailVerification(
        details.email,
        result.pending!.id,
        codeFor(details.email),
        ip,
      )
    ).success,
    false,
  );
  assert.equal(
    (await db.select().from(users).where(eq(users.email, details.email)))
      .length,
    0,
  );
});

test('concurrent correct requests consume the code once', async () => {
  const details = fresh();
  const ip = randomUUID();
  const result = await beginEmailVerification(details, ip);
  const attempts = await Promise.all(
    [0, 1].map(() =>
      completeEmailVerification(
        details.email,
        result.pending!.id,
        codeFor(details.email),
        ip,
      ),
    ),
  );
  assert.equal(attempts.filter((value) => value.success).length, 1);
  assert.equal(
    (await db.select().from(users).where(eq(users.email, details.email)))
      .length,
    1,
  );
});

test('concurrent code requests send only one email during the cooldown', async () => {
  const details = fresh();
  const ip = randomUUID();
  const results = await Promise.all([
    beginEmailVerification(details, ip),
    beginEmailVerification(details, ip),
  ]);
  assert.equal(results.filter((value) => value.success).length, 1);
  assert.equal(sent.get(details.email)?.length, 1);
});

test('delivery failure leaves no active account and a retryable challenge', async () => {
  const details = fresh();
  const ip = randomUUID();
  failDelivery = true;
  const result = await beginEmailVerification(details, ip);
  failDelivery = false;
  assert.equal(result.success, false);
  assert.ok(result.pending);
  assert.equal(
    (await db.select().from(users).where(eq(users.email, details.email)))
      .length,
    0,
  );
  await db
    .update(emailChallenges)
    .set({ sentAt: new Date(Date.now() - 61_000) })
    .where(eq(emailChallenges.email, details.email));
  const retry = await resendEmailVerification(
    details.email,
    result.pending.id,
    ip,
  );
  assert.equal(retry.success, true);
});

test('verification cannot replace an account that became verified in the meantime', async () => {
  const details = fresh();
  const ip = randomUUID();
  const result = await beginEmailVerification(details, ip);
  const [existing] = await db
    .insert(users)
    .values({
      name: 'Existing Google user',
      email: details.email,
      emailVerified: new Date(),
    })
    .returning();
  assert.equal(
    (
      await completeEmailVerification(
        details.email,
        result.pending!.id,
        codeFor(details.email),
        ip,
      )
    ).success,
    false,
  );
  const [user] = await db.select().from(users).where(eq(users.id, existing.id));
  assert.equal(user.hashedPassword, null);
  assert.equal(user.name, 'Existing Google user');
});

test('legacy unverified password accounts activate without creating another user', async () => {
  const details = fresh();
  const ip = randomUUID();
  const [existing] = await db
    .insert(users)
    .values({
      name: details.name,
      email: details.email,
      hashedPassword,
      emailVerified: null,
    })
    .returning();
  const result = await beginEmailVerification(
    { ...details, userId: existing.id },
    ip,
  );
  assert.equal(
    (
      await completeEmailVerification(
        details.email,
        result.pending!.id,
        codeFor(details.email),
        ip,
      )
    ).success,
    true,
  );
  const activated = await db
    .select()
    .from(users)
    .where(eq(users.email, details.email));
  assert.equal(activated.length, 1);
  assert.equal(activated[0].id, existing.id);
  assert.ok(activated[0].emailVerified);
  assert.equal(
    (
      await db
        .select()
        .from(emailChallenges)
        .where(
          and(
            eq(emailChallenges.email, details.email),
            eq(emailChallenges.id, result.pending!.id),
          ),
        )
    ).length,
    0,
  );
});
