import 'dotenv/config';

import { writeFileSync } from 'fs';
import { Client } from 'pg';
import { replaceFlagImage } from '../../src/lib/storage/flag-image-repair';

/**
 * Wikimedia now serves thumbnails only at standard widths, so older links such as
 * .../thumb/a/ab/Flag.svg/2560px-Flag.svg.png return 400. This points each broken one at the
 * original file, copies it to CloudFront, re-reads its colours, and gives community posts made
 * from those flags the same image. Links that still load are left alone.
 *
 *   npx tsx scripts/storage/fix-wikimedia-thumbs.ts            (lists what it would change)
 *   npx tsx scripts/storage/fix-wikimedia-thumbs.ts --apply --log changes.json
 */

const apply = process.argv.includes('--apply');
const logPath = process.argv[process.argv.indexOf('--log') + 1];
const USER_AGENT = 'Vexilo/1.0 (https://vexilo.org; flag image repair)';

/** .../commons/thumb/a/ab/File.svg/2560px-File.svg.png -> .../commons/a/ab/File.svg */
function originalFile(url: string) {
  const match = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+\/)thumb\/([0-9a-f]\/[0-9a-f]{2}\/[^/]+)\/[^/]+$/);
  return match ? match[1] + match[2] : null;
}

async function status(url: string) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) }).catch(() => null);
  await response?.body?.cancel();
  return response?.status ?? 0;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const changes: { flagId: string; name: string; oldImage: string; newImage?: string; posts?: number; error?: string }[] = [];
  try {
    const { rows } = await client.query<{ id: string; name: string; image: string }>(
      `select id, name, image from vexilo_flag where image like 'https://upload.wikimedia.org/%/thumb/%' order by name`,
    );
    for (const flag of rows) {
      const original = originalFile(flag.image);
      if (!original) continue;
      const [current, fixed] = [await status(flag.image), await status(original)];
      if (current === 200) continue;
      if (fixed !== 200) {
        console.log(`skip  ${flag.name}: original file returns ${fixed}`);
        continue;
      }
      if (!apply) {
        console.log(`would fix  ${flag.name}: ${current} -> ${original}`);
        continue;
      }
      try {
        const result = await replaceFlagImage(flag.id, original, flag.image);
        if (!result) throw new Error('image changed since it was read');
        // Posts made from this flag still show the dead link.
        const posts = await client.query(
          `update vexilo_saved_flag set image = $2, palette = $3, palette_image = $2, updated_at = now()
            where flag_id = $1 and image = $4`,
          [flag.id, result.image, JSON.stringify(result.colors), flag.image],
        );
        changes.push({ flagId: flag.id, name: flag.name, oldImage: flag.image, newImage: result.image, posts: posts.rowCount ?? 0 });
        console.log(`fixed  ${flag.name} -> ${result.image} (${result.colors.length} colours, ${posts.rowCount} posts)`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        changes.push({ flagId: flag.id, name: flag.name, oldImage: flag.image, error: message });
        console.error(`failed ${flag.name}: ${message}`);
      }
    }
  } finally {
    await client.end();
    if (apply && logPath && logPath !== '--apply') writeFileSync(logPath, JSON.stringify(changes, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
