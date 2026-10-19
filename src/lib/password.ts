import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, OPTIONS, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt-v1:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string | null) {
  const [version, salt, hash] = (encoded ?? '').split(':');
  const valid =
    version === 'scrypt-v1' &&
    /^[a-f0-9]{32}$/.test(salt ?? '') &&
    /^[a-f0-9]{128}$/.test(hash ?? '');
  // Missing accounts do the same expensive work as a wrong password.
  const key = await derive(
    password,
    valid ? salt : '00000000000000000000000000000000',
  );
  return (
    timingSafeEqual(key, valid ? Buffer.from(hash, 'hex') : Buffer.alloc(64)) &&
    valid
  );
}
