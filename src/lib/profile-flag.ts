import { db } from '@/db';
import { flags, savedFlags, users } from '@/db/schema';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { postPath } from '@/lib/post-slug';

/** The flag someone shows on their profile: one of their own posts, or a real flag. */
export type ProfileFlag = {
  id: string;
  name: string;
  image: string;
  href: string;
  kind: 'post' | 'flag';
};

type ProfileFlagRefs = { id: string; favoriteFlagId: string | null; profilePostId: string | null };

/** Each user's profile flag, in two queries however many users there are. */
export async function getProfileFlags(people: ProfileFlagRefs[]): Promise<Map<string, ProfileFlag>> {
  const result = new Map<string, ProfileFlag>();
  const postIds = [...new Set(people.map((p) => p.profilePostId).filter((id): id is string => !!id))];
  const flagIds = [...new Set(people.map((p) => p.favoriteFlagId).filter((id): id is string => !!id))];

  const [posts, realFlags] = await Promise.all([
    postIds.length
      ? db
          .select({ id: savedFlags.id, name: savedFlags.name, image: savedFlags.image, slug: savedFlags.slug, username: users.name })
          .from(savedFlags)
          .innerJoin(users, eq(users.id, savedFlags.userId))
          .where(and(inArray(savedFlags.id, postIds), isNotNull(savedFlags.publishedAt)))
      : [],
    flagIds.length
      ? db.select({ id: flags.id, name: flags.name, image: flags.image }).from(flags).where(inArray(flags.id, flagIds))
      : [],
  ]);
  const postById = new Map(posts.map((p) => [p.id, p]));
  const flagById = new Map(realFlags.map((f) => [f.id, f]));

  for (const person of people) {
    const post = person.profilePostId ? postById.get(person.profilePostId) : undefined;
    if (post?.slug) {
      result.set(person.id, { id: post.id, name: post.name, image: post.image, href: postPath(post.username, post.slug), kind: 'post' });
      continue;
    }
    const flag = person.favoriteFlagId ? flagById.get(person.favoriteFlagId) : undefined;
    if (flag) {
      result.set(person.id, { id: flag.id, name: flag.name, image: flag.image, href: `/flag/${encodeURIComponent(flag.name)}`, kind: 'flag' });
    }
  }
  return result;
}

export async function getProfileFlag(person: ProfileFlagRefs): Promise<ProfileFlag | null> {
  return (await getProfileFlags([person])).get(person.id) ?? null;
}
