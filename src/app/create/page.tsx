import type { Metadata } from 'next';
import { getStudioContest } from '@/actions/contests';
import Studio from '@/components/studio/Studio';
import { getRemixSource, getStudioEmblems } from '@/lib/studio-data';

export const metadata: Metadata = {
  title: 'Flag maker - Vexilo',
  description: 'Design your own flag or remix any flag on Vexilo, with thousands of searchable emblems from real flags.',
};

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ remix?: string; contest?: string }> }) {
  const { remix, contest: contestSlug } = await searchParams;
  const [emblems, contest] = await Promise.all([getStudioEmblems(), contestSlug ? getStudioContest(contestSlug) : null]);
  // Contest entries start from scratch (or the entry so far), never from a remix of a real flag.
  const source = remix && !contest ? await getRemixSource(remix) : null;
  return <Studio key={contest ? `contest-${contest.slug}` : (source?.id ?? 'new')} emblems={emblems} remix={source} contest={contest} />;
}
