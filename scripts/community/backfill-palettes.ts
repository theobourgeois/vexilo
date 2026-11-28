import 'dotenv/config';

import { Client } from 'pg';
import { readImagePalette } from '../../src/lib/flag-palette';

/**
 * Stores each post's colours (its page header and profile banner use them), for posts made
 * before colours were saved on publish. Posts that were encyclopedia flags copy the colours the
 * flag already had; the rest have their image read. Only fills posts whose colours are missing or
 * were read from an older image, so it's safe to run again, and it never touches anything else.
 *
 *   npm run community:palettes
 *   npm run community:palettes -- --dry-run
 */

const dryRun = process.argv.includes('--dry-run');
const CONCURRENCY = 4;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Moved flags: the colours are already known for the same picture.
    const copied = dryRun
      ? await client.query(
          `select 1 from vexilo_saved_flag s join vexilo_flag_color c on c.flag_id = s.flag_id and c.image = s.image
            where s.published_at is not null and (s.palette is null or s.palette_image is distinct from s.image)`,
        )
      : await client.query(
          `update vexilo_saved_flag s set palette = c.colors, palette_image = s.image
             from vexilo_flag_color c
            where c.flag_id = s.flag_id and c.image = s.image
              and s.published_at is not null and (s.palette is null or s.palette_image is distinct from s.image)`,
        );
    console.log(`${dryRun ? 'Would copy' : 'Copied'} colours for ${copied.rowCount ?? 0} moved flags.`);

    const { rows } = await client.query<{ id: string; image: string }>(
      `select id, image from vexilo_saved_flag
        where published_at is not null and (palette is null or palette_image is distinct from image)
        order by likes desc`,
    );
    console.log(`${rows.length} posts need their image read.`);
    if (dryRun) return;

    let done = 0;
    let empty = 0;
    const queue = [...rows];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let post = queue.shift(); post; post = queue.shift()) {
          const palette = await readImagePalette(post.image);
          if (palette.length === 0) empty++;
          // Only if the image is still the one that was read.
          await client.query(`update vexilo_saved_flag set palette = $2, palette_image = $3 where id = $1 and image = $3`, [
            post.id,
            JSON.stringify(palette),
            post.image,
          ]);
          if (++done % 50 === 0) console.log(`  ${done}/${rows.length}`);
        }
      }),
    );
    console.log(`Read ${done} images (${empty} couldn't be read and got no colours).`);
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
