import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateVerificationCode,
  verificationCodeHash,
} from './email-verification-code';
import { verificationEmail } from './emails/verify-email';
import { sendVerificationEmail } from './email';

test('codes have six digits and their hashes are bound to the email and challenge', () => {
  process.env.NEXTAUTH_SECRET = 'verification-unit-test-secret';
  for (let i = 0; i < 100; i++)
    assert.match(generateVerificationCode(), /^\d{6}$/);
  const hash = verificationCodeHash(
    'user@example.test',
    'challenge-a',
    '012345',
  );
  assert.equal(hash.length, 64);
  assert.notEqual(
    hash,
    verificationCodeHash('other@example.test', 'challenge-a', '012345'),
  );
  assert.notEqual(
    hash,
    verificationCodeHash('user@example.test', 'challenge-b', '012345'),
  );
  assert.notEqual(
    hash,
    verificationCodeHash('user@example.test', 'challenge-a', '012346'),
  );
});

test('the email has matching HTML and plain text, the website logo, and no user HTML', () => {
  const message = verificationEmail('012345');
  assert.ok(message.html.includes('012345'));
  assert.ok(message.text.includes('012345'));
  assert.ok(message.text.includes('10 minutes'));
  assert.ok(message.html.includes('role="presentation"'));
  assert.ok(message.html.includes('src="https://vexilo.org/logo.png"'));
  assert.equal(/WELCOME TO VEXILO|one step away/i.test(message.html), false);
  assert.equal(/<script|<link\b/i.test(message.html), false);
  assert.throws(() => verificationEmail('<script>'));
});

test('Resend receives the configured sender, text and HTML, with safe retry identity', async (context) => {
  process.env.RESEND_API_KEY = 'test-only-key';
  process.env.EMAIL_FROM = 'Vexilo <noreply@mail.example.test>';
  const fetch = context.mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(input, 'https://api.resend.com/emails');
      assert.equal(
        new Headers(init?.headers).get('Idempotency-Key'),
        'verify-email/challenge-a',
      );
      const body = JSON.parse(String(init?.body));
      assert.equal(body.from, process.env.EMAIL_FROM);
      assert.deepEqual(body.to, ['user@example.test']);
      assert.ok(body.html.includes('012345'));
      assert.ok(body.text.includes('012345'));
      assert.equal('password' in body, false);
      return new Response(JSON.stringify({ id: 'test-email-id' }), {
        status: 200,
      });
    },
  );
  await sendVerificationEmail('user@example.test', '012345', 'challenge-a');
  fetch.mock.mockImplementation(
    async () => new Response('{}', { status: 403 }),
  );
  await assert.rejects(
    sendVerificationEmail('user@example.test', '012345', 'challenge-b'),
    /delivery failed/,
  );
});
