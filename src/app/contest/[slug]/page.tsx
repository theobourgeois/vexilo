import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContestArchive, getContestView } from '@/actions/contests';
import ContestPage from '@/components/contest/ContestPage';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = await getContestView(slug);
  if (!view) return { title: 'Design contest - Vexilo' };
  const { contest, winner } = view;
  return {
    title: `${contest.theme} · ${contest.title} design contest - Vexilo`,
    description: winner ? `${winner.title} by ${winner.designer.name} won the ${contest.title} contest.` : contest.brief.slice(0, 160),
    openGraph: winner ? { images: [winner.image] } : undefined,
  };
}

export default async function ContestSlugPage({ params }: Props) {
  const { slug } = await params;
  const [view, archive] = await Promise.all([getContestView(slug), getContestArchive()]);
  if (!view) notFound();
  return <ContestPage view={view} archive={archive.filter((contest) => contest.id !== view.contest.id && contest.phase === 'results')} />;
}
