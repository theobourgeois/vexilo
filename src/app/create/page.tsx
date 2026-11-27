import type { Metadata } from 'next';
import { getStudioContest } from '@/actions/contests';
import { getSavedFlagSource } from '@/actions/my-flags';
import StudioRoute from '@/components/studio/StudioRoute';
import { getPostRemixSource, getRemixSource } from '@/lib/studio-data';

export const metadata: Metadata = {
  title: 'Flag maker - Vexilo',
  description: 'Design your own flag or remix any flag on Vexilo, with thousands of searchable emblems from real flags.',
};

// The emblem library isn't sent with the page; Studio fetches it from /api/studio-emblems.
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ remix?: string; remixPost?: string; contest?: string; flag?: string }>;
}) {
  const { remix, remixPost, contest: contestSlug, flag } = await searchParams;
  const contest = contestSlug ? await getStudioContest(contestSlug) : null;
  // One of your saved flags, from My Flags. Someone else's (or a deleted one) opens a blank flag.
  const saved = flag && !contest ? await getSavedFlagSource(flag) : null;
  // Contest entries start from scratch (or the entry so far), never from a remix of a real flag.
  // ?remix= is a real flag, ?remixPost= someone's post.
  const source =
    contest || saved ? null : remixPost ? await getPostRemixSource(remixPost) : remix ? await getRemixSource(remix) : null;
  return (
    <StudioRoute
      identity={contest ? `contest-${contest.slug}` : saved ? `saved-${saved.id}` : (source?.id ?? 'new')}
      remix={source}
      contest={contest}
      saved={saved}
    />
  );
}
