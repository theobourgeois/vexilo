import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from './password';
import { signupSchema } from './auth-validation';
import { safeCallbackUrl } from './sign-in';

test('sign-in returns to a local editor URL and rejects external or looping callbacks', () => {
  const origin = 'https://vexilo.org';
  assert.equal(safeCallbackUrl('/create?remix=123#d=abc', origin), '/create?remix=123#d=abc');
  assert.equal(safeCallbackUrl('https://vexilo.org/settings', origin), '/settings');
  for (const url of ['https://example.com', '//example.com', '/signin?callbackUrl=/signin', 'javascript:alert(1)']) {
    assert.equal(safeCallbackUrl(url, origin), '/');
  }
});

test('password hashes use random salts and verify only the matching password', async () => {
  const password = 'a long passphrase with spaces 🔵';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong password', first), false);
  assert.equal(await verifyPassword(password, null), false);
  assert.equal(await verifyPassword(password, 'scrypt-v1:bad:bad'), false);
});

test('signup normalizes email and validates password length without trimming passwords', () => {
  const result = signupSchema.safeParse({
    name: ' New User ',
    email: ' NEW@EXAMPLE.COM ',
    password: ' keep spaces ',
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, 'new@example.com');
    assert.equal(result.data.name, 'New User');
    assert.equal(result.data.password, ' keep spaces ');
  }
  for (const patch of [
    { email: 'invalid' },
    { name: '  ' },
    { password: 'short' },
    { password: 'x'.repeat(129) },
  ]) {
    assert.equal(
      signupSchema.safeParse({
        name: 'User',
        email: 'user@example.com',
        password: 'a valid long passphrase',
        ...patch,
      }).success,
      false,
    );
  }
});
