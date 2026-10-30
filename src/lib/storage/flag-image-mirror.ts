import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { flags } from '@/db/schema';
import { expireCache, FLAGS_TAG } from '@/lib/cache-tags';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { moveFlagColors } from '@/lib/flag-palette';

type MirrorableFlag = {
  id: string;
  name: string;
  index: number;
  image: string;
};

const DEFAULT_REGION = process.env.S3_REGION || 'us-east-2';
const cloudFrontHost = new URL(CLOUD_FRONT_URL).hostname;
const inFlightMirrors = new Map<string, Promise<string>>();

let s3Client: S3Client | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  s3Client = new S3Client({
    region: DEFAULT_REGION,
    credentials: {
      accessKeyId: getRequiredEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('S3_SECRET_ACCESS_KEY'),
    },
  });

  return s3Client;
}

function getBucketName(): string {
  return getRequiredEnv('S3_BUCKET_NAME');
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function getS3Hosts(bucketName: string, region: string): Set<string> {
  return new Set([
    `${bucketName}.s3.amazonaws.com`,
    `${bucketName}.s3.${region}.amazonaws.com`,
    's3.amazonaws.com',
    `s3.${region}.amazonaws.com`,
  ]);
}

export function isSelfHostedFlagImage(url: string): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === cloudFrontHost) {
      return true;
    }

    const bucketName = process.env.S3_BUCKET_NAME?.trim();
    if (!bucketName) {
      return false;
    }

    const s3Hosts = getS3Hosts(bucketName, DEFAULT_REGION);
    return (
      s3Hosts.has(hostname) &&
      (hostname.startsWith(`${bucketName}.`) ||
        parsedUrl.pathname.startsWith(`/${bucketName}/`))
    );
  } catch {
    return true;
  }
}

function extensionFromContentType(
  contentType: string | null,
): string | undefined {
  if (!contentType) {
    return undefined;
  }

  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const contentTypeMap: Record<string, string> = {
    'image/svg+xml': 'svg',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
  };

  return contentTypeMap[normalized];
}

function extensionFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/);
    if (!match) {
      return undefined;
    }

    const extension = match[1];
    const allowedExtensions = new Set([
      'svg',
      'png',
      'jpg',
      'jpeg',
      'webp',
      'gif',
      'avif',
      'bmp',
      'ico',
    ]);

    return allowedExtensions.has(extension) ? extension : undefined;
  } catch {
    return undefined;
  }
}

function contentTypeFromExtension(extension: string): string {
  const normalized = extension.toLowerCase();
  const extensionMap: Record<string, string> = {
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
  };

  return extensionMap[normalized] || 'application/octet-stream';
}

function getTargetKey(flag: MirrorableFlag, extension: string): string {
  const slug = slugify(flag.name) || `flag-${flag.index}`;
  const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension;
  return `flags/${flag.index}-${slug}.${normalizedExtension}`;
}

async function downloadExternalImage(url: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
  extension: string;
}> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'vexilo-flag-image-mirror/1.0',
      accept: 'image/*,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Download failed with status ${response.status} ${response.statusText}`,
    );
  }

  const finalUrl = response.url || url;
  const contentTypeHeader = response.headers.get('content-type');
  const extension =
    extensionFromContentType(contentTypeHeader) ||
    extensionFromUrl(finalUrl) ||
    extensionFromUrl(url);

  if (!extension) {
    throw new Error(
      `Could not determine file extension from content-type "${contentTypeHeader}" or URL`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error('Downloaded image is empty');
  }

  return {
    bytes,
    contentType: contentTypeFromExtension(extension),
    extension,
  };
}

async function mirrorFlagImage(flag: MirrorableFlag): Promise<string> {
  if (isSelfHostedFlagImage(flag.image)) {
    return flag.image;
  }

  const download = await downloadExternalImage(flag.image);
  const key = getTargetKey(flag, download.extension);
  const targetUrl = `${CLOUD_FRONT_URL}/${key}`;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: Buffer.from(download.bytes),
      ContentType: download.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  await db
    .update(flags)
    .set({
      image: targetUrl,
    })
    .where(and(eq(flags.id, flag.id), eq(flags.image, flag.image)));
  // Cached flag pages still point at the old link and would keep re-mirroring it.
  expireCache(FLAGS_TAG);
  await moveFlagColors(flag.id, flag.image, targetUrl);

  return targetUrl;
}

export async function ensureFlagImageSelfHosted(
  flag: MirrorableFlag,
): Promise<string> {
  if (isSelfHostedFlagImage(flag.image)) {
    console.log('Flag image is already self-hosted', flag.image);
    return flag.image;
  }

  const existingMirror = inFlightMirrors.get(flag.id);
  if (existingMirror) {
    console.log('Flag image is already being mirrored', flag.image);
    return existingMirror;
  }

  console.log('Mirroring flag image', flag.image);
  const mirrorPromise = mirrorFlagImage(flag).finally(() => {
    inFlightMirrors.delete(flag.id);
  });

  inFlightMirrors.set(flag.id, mirrorPromise);
  console.log('Set inFlightMirrors', flag.id);
  return mirrorPromise;
}
