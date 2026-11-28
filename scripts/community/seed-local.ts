import 'dotenv/config';

import { Client } from 'pg';
import { hashPassword } from '../../src/lib/password';
import { firstFreeSlug, slugBase } from '../../src/lib/post-slug';

/**
 * Fills a LOCAL database with community activity, so the feed, profiles and the bell have
 * something in them: follows, likes, notifications, bios, pinned posts and views, plus a test
 * account to sign in with (email + password, below) that has a few posts of its own.
 *
 * It refuses to run unless DATABASE_URL points at localhost, and runs in one transaction.
 * Running it again only resets the test account's password: follows and likes are seeded once,
 * when the test account is first made. --reset removes the test account and its posts, and every
 * follow, like and notification (including ones that weren't seeded), then seeds from scratch.
 *
 *   npm run community:seed
 *   npm run community:seed -- --reset
 */

const TEST_EMAIL = 'tester@vexilo.local';
const TEST_PASSWORD = 'vexilo-local';
const TEST_NAME = 'vexilo_tester';

const args = process.argv.slice(2);
const reset = args.includes('--reset');

const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusing to seed: DATABASE_URL is not a local database.');
  process.exit(1);
}

// A small seeded random, so every run makes the same graph.
let seed = 20261127;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
const sample = <T>(items: T[], n: number) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

const BIOS = [
  'Redesigning every US state flag, one at a time.',
  'Vexillology nerd. Simple flags, bold colours, no seals on bedsheets.',
  'Alt-history flags for worlds that never happened.',
  'I make flags for my D&D campaign and post the good ones.',
  'Two colours and a symbol. That’s the rule.',
  'Micronation enthusiast. Hoisting since 2019.',
  'Flags for cities that deserve better ones.',
  'Learning design by remixing the classics.',
  'Tricolours are my comfort food.',
  'Making a flag for every fictional country I read about.',
];
const LOCATIONS = ['Lisbon', 'Montréal', 'Chicago', 'Osaka', 'Melbourne', 'Kraków', 'São Paulo', 'Edinburgh', 'Nairobi', 'Toronto', ''];
const LINKS = ['https://www.reddit.com/r/vexillology', 'https://example.com/flags', '', '', ''];

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');

    if (reset) {
      await client.query(`delete from vexilo_notification`);
      await client.query(`delete from vexilo_follow`);
      await client.query(`delete from vexilo_post_like`);
      await client.query(
        `delete from vexilo_saved_flag where user_id in (select id from vexilo_user where lower(email) = lower($1))`,
        [TEST_EMAIL],
      );
      await client.query(`delete from vexilo_user where lower(email) = lower($1)`, [TEST_EMAIL]);
      console.log('Reset: removed follows, likes, notifications and the test account.');
    }

    // ── The test account ──
    const hashed = await hashPassword(TEST_PASSWORD);
    const { rows: [tester] } = await client.query<{ id: string }>(
      `insert into vexilo_user (name, email, email_verified, hashed_password, bio, location, created_at)
       values ($1, $2, now(), $3, 'Testing the community locally.', 'Localhost', now() - interval '90 days')
       on conflict (lower(email)) do update set hashed_password = excluded.hashed_password, email_verified = now()
       returning id`,
      [TEST_NAME, TEST_EMAIL, hashed],
    );

    // Posters, most active first, and people who could follow and like.
    const { rows: posters } = await client.query<{ id: string; name: string; posts: number }>(
      `select u.id, u.name, count(*)::int as posts
         from vexilo_saved_flag s join vexilo_user u on u.id = s.user_id
        where s.published_at is not null and s.slug is not null and not u.is_anonymous and u.id <> $1
        group by u.id order by posts desc`,
      [tester.id],
    );
    const { rows: everyone } = await client.query<{ id: string }>(
      `select id from vexilo_user where not is_anonymous and id <> $1 order by created_at`,
      [tester.id],
    );
    const { rows: posts } = await client.query<{ id: string; user_id: string; name: string; image: string; design: unknown; published_at: Date; tags: string[] }>(
      `select id, user_id, name, image, design, published_at, tags from vexilo_saved_flag
        where published_at is not null and slug is not null and user_id <> $1`,
      [tester.id],
    );
    console.log(`${posters.length} posters, ${everyone.length} people, ${posts.length} posts`);

    // ── The test account's own posts: copies of a few designs, one a remix of someone's post ──
    const { rows: mine } = await client.query<{ n: number }>(`select count(*)::int as n from vexilo_saved_flag where user_id = $1`, [tester.id]);
    const testerPostIds: string[] = [];
    const fresh = mine[0].n === 0;
    if (!fresh) {
      await client.query('commit');
      console.log('Already seeded (the test account has posts); run with --reset to seed again.');
      console.log(`\nSign in locally with ${TEST_EMAIL} / ${TEST_PASSWORD}  (profile: /@${TEST_NAME})`);
      return;
    }
    {
      const withDesign = posts.filter((post) => post.design);
      const taken = new Set<string>();
      const sources = sample(withDesign, 4);
      for (const [index, source] of sources.entries()) {
        const remix = index === 0;
        const name = remix ? `${source.name} (my take)` : `${source.name} II`;
        const slug = firstFreeSlug(slugBase(name), taken);
        taken.add(slug);
        const published = daysAgo(1 + index * 3);
        const { rows: [row] } = await client.query<{ id: string }>(
          `insert into vexilo_saved_flag (user_id, name, design, image, description, tags, slug, published_at, remix_of_post_id, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, $8) returning id`,
          [
            tester.id,
            name,
            JSON.stringify(source.design),
            source.image,
            remix ? 'Started from someone else’s design and pushed the colours further.' : 'A local test post.',
            source.tags,
            slug,
            published,
            remix ? source.id : null,
          ],
        );
        testerPostIds.push(row.id);
        if (remix) {
          await client.query(
            `insert into vexilo_notification (user_id, actor_id, type, post_id, created_at) values ($1, $2, 'remix', $3, $4) on conflict do nothing`,
            [source.user_id, tester.id, row.id, published],
          );
        }
      }
      // One draft, never posted, for My flags.
      const draft = pick(withDesign);
      await client.query(
        `insert into vexilo_saved_flag (user_id, name, design, image, tags, created_at, updated_at) values ($1, $2, $3, $4, '{}', now(), now())`,
        [tester.id, `${draft.name} (draft)`, JSON.stringify(draft.design), draft.image],
      );
      console.log(`Test account: ${testerPostIds.length} posts and a draft`);
    }

    // ── Bios, links and locations for posters who have none ──
    let bios = 0;
    for (const poster of posters.slice(0, 30)) {
      const { rowCount } = await client.query(
        `update vexilo_user set bio = $2, location = $3, link = $4 where id = $1 and bio = ''`,
        [poster.id, pick(BIOS), pick(LOCATIONS), pick(LINKS)],
      );
      bios += rowCount ?? 0;
    }

    // ── Follows: people follow posters, the busiest most ──
    const followPairs: [string, string, Date][] = [];
    const weighted = posters.flatMap((poster, rank) => Array(Math.max(1, 12 - Math.floor(rank / 3))).fill(poster.id) as string[]);
    for (const follower of sample(everyone, 220)) {
      const targets = new Set(sample(weighted, 2 + Math.floor(random() * 10)));
      for (const target of targets) if (target !== follower.id) followPairs.push([follower.id, target, daysAgo(random() * 60)]);
    }
    for (const poster of sample(posters, 10)) followPairs.push([tester.id, poster.id, daysAgo(random() * 20)]);
    for (const follower of sample(everyone, 14)) followPairs.push([follower.id, tester.id, daysAgo(random() * 10)]);
    let follows = 0;
    for (const [follower, following, at] of followPairs) {
      const { rowCount } = await client.query(
        `insert into vexilo_follow (follower_id, following_id, created_at) values ($1, $2, $3) on conflict do nothing`,
        [follower, following, at],
      );
      if (rowCount) {
        follows++;
        await client.query(
          `insert into vexilo_notification (user_id, actor_id, type, post_id, created_at) values ($1, $2, 'follow', null, $3) on conflict do nothing`,
          [following, follower, at],
        );
      }
    }

    // ── Likes: newer posts and a lucky few get the most ──
    const allPosts = [...posts.map((post) => ({ id: post.id, owner: post.user_id, at: new Date(post.published_at) }))];
    for (const id of testerPostIds) allPosts.push({ id, owner: tester.id, at: daysAgo(3) });
    let likes = 0;
    for (const post of allPosts) {
      const ageDays = (Date.now() - post.at.getTime()) / 86_400_000;
      const hot = random() < 0.08 ? 4 : 1;
      const count = Math.floor(random() * random() * 22 * hot) + (testerPostIds.includes(post.id) ? 6 : 0);
      for (const liker of sample(everyone, count)) {
        if (liker.id === post.owner) continue;
        const at = new Date(post.at.getTime() + random() * Math.max(ageDays, 0.5) * 86_400_000);
        const { rowCount } = await client.query(
          `insert into vexilo_post_like (user_id, post_id, created_at) values ($1, $2, $3) on conflict do nothing`,
          [liker.id, post.id, at > new Date() ? new Date() : at],
        );
        if (rowCount) {
          likes++;
          await client.query(
            `insert into vexilo_notification (user_id, actor_id, type, post_id, created_at) values ($1, $2, 'like', $3, $4) on conflict do nothing`,
            [post.owner, liker.id, post.id, at > new Date() ? new Date() : at],
          );
        }
      }
    }
    // The test account likes a few things too, for its Liked tab.
    for (const post of sample(posts, 15)) {
      const at = daysAgo(random() * 14);
      const { rowCount } = await client.query(
        `insert into vexilo_post_like (user_id, post_id, created_at) values ($1, $2, $3) on conflict do nothing`,
        [tester.id, post.id, at],
      );
      if (rowCount) {
        likes++;
        await client.query(
          `insert into vexilo_notification (user_id, actor_id, type, post_id, created_at) values ($1, $2, 'like', $3, $4) on conflict do nothing`,
          [post.user_id, tester.id, post.id, at],
        );
      }
    }
    // The counters follow the likes table.
    await client.query(
      `update vexilo_saved_flag s set likes = coalesce(l.n, 0)
         from (select s2.id, count(pl.post_id)::int as n from vexilo_saved_flag s2
                 left join vexilo_post_like pl on pl.post_id = s2.id group by s2.id) l
        where l.id = s.id and s.likes is distinct from coalesce(l.n, 0)`,
    );
    // Views, a multiple of likes, where nobody has looked yet.
    await client.query(`update vexilo_saved_flag set views = likes * (8 + floor(random() * 25))::int + floor(random() * 40)::int where published_at is not null and views = 0`);

    // Older notifications have been seen; the last few days' are new.
    await client.query(`update vexilo_notification set read_at = created_at + interval '1 hour' where read_at is null and created_at < now() - interval '4 days'`);

    // ── Pinned posts and profile flags for the top posters ──
    let pinned = 0;
    for (const poster of [...posters.slice(0, 12), { id: tester.id, name: TEST_NAME, posts: 0 }]) {
      const { rows: best } = await client.query<{ id: string }>(
        `select id from vexilo_saved_flag where user_id = $1 and published_at is not null order by likes desc, published_at desc limit 2`,
        [poster.id],
      );
      if (best.length === 0) continue;
      const { rowCount } = await client.query(
        `update vexilo_user set pinned_post_ids = $2::uuid[], profile_post_id = coalesce(profile_post_id, case when favorite_flag_id is null then $3::uuid end)
          where id = $1 and cardinality(pinned_post_ids) = 0`,
        [poster.id, best.map((row) => row.id), best[0].id],
      );
      pinned += rowCount ?? 0;
    }

    await client.query('commit');
    const { rows: [totals] } = await client.query(
      `select (select count(*) from vexilo_follow)::int as follows, (select count(*) from vexilo_post_like)::int as likes,
              (select count(*) from vexilo_notification)::int as notifications,
              (select count(*) from vexilo_notification where read_at is null)::int as unread`,
    );
    console.log(`Added ${follows} follows, ${likes} likes; ${bios} bios, ${pinned} pinned sets.`);
    console.log(`Now: ${totals.follows} follows, ${totals.likes} likes, ${totals.notifications} notifications (${totals.unread} unread).`);
    console.log(`\nSign in locally with ${TEST_EMAIL} / ${TEST_PASSWORD}  (profile: /@${TEST_NAME})`);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
