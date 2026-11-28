// Local sandbox for uploads. When the app runs against a local database outside production, files
// go to `.local-uploads/` on disk instead of the real bucket, so testing never writes to or deletes
// from prod S3 (the dev `.env` holds real S3 credentials). Set LOCAL_UPLOADS=off to opt out.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CLOUD_FRONT_URL } from '@/lib/constant';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const ROOT = path.join(process.cwd(), '.local-uploads');

function databaseIsLocal() {
  try {
    return LOCAL_HOSTS.has(new URL(process.env.DATABASE_URL ?? '').hostname);
  } catch {
    return false;
  }
}

export const isLocalStorage = () =>
  process.env.NODE_ENV !== 'production' && process.env.LOCAL_UPLOADS !== 'off' && databaseIsLocal();

/** Where stored files live: the CDN in production, this dev server's `/local-uploads` locally. */
export const uploadBaseUrl = () =>
  isLocalStorage()
    ? `${(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/local-uploads`
    : CLOUD_FRONT_URL;

/** The public URL of a stored file's key. */
export const storedFileUrl = (key: string) => `${uploadBaseUrl()}/${key}`;

/** Whether a URL points at a file we stored (and so may delete). */
export const isStoredFileUrl = (url: string, prefix = '') => url.startsWith(`${uploadBaseUrl()}/${prefix}`);

function localPath(key: string) {
  const file = path.resolve(ROOT, key);
  if (!file.startsWith(`${ROOT}${path.sep}`)) throw new Error('Invalid key');
  return file;
}

export async function writeLocalFile(key: string, body: Buffer | Uint8Array | string) {
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function readLocalFile(key: string) {
  return readFile(localPath(key)).catch(() => null);
}

export async function deleteLocalFile(key: string) {
  await rm(localPath(key), { force: true });
}
