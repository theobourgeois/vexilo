import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContestArchive, getContestView } from '@/actions/contests';
import ContestPage from '@/components/contest/ContestPage';
import { CONTEST_ART } from '@/lib/contest';
import { absoluteUrl, contestPath } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

/** The brief cut to search snippet length, ending on a whole sentence when one fits. */
function briefSnippet(brief: string, max = 160) {
  if (brief.length <= max) return brief;
  const cut = brief.slice(0, max);
  return cut.match(/^[\s\S]*[.!?](?=\s)/)?.[0] ?? cut.replace(/\s+\S*$/, '');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = await getContestView(slug);
  if (!view) return { title: 'Design contest - Vexilo' };
  const { contest, winner } = view;
  const title = `${contest.theme} · ${contest.title} design contest - Vexilo`;
  const description = winner
    ? `${winner.title} by ${winner.designer.name} won the ${contest.title} contest.`
    : briefSnippet(contest.brief) || `Design a flag for “${contest.theme}” in the ${contest.title} contest on Vexilo.`;
  const url = absoluteUrl(contestPath(contest.slug));
  const shareImage = CONTEST_ART[contest.slug];
  return {
    title,
    description,
    alternates: { canonical: url },
    // Replaces the site-wide Open Graph tags, which would share this page as the home page.
    openGraph: { title, description, url, siteName: 'Vexilo', images: [winner ? { url: winner.image, alt: winner.title } : shareImage ? { url: shareImage, alt: contest.theme } : { url: '/logo.png', alt: 'Vexilo' }] },
  };
}

export default async function ContestSlugPage({ params }: Props) {
  const { slug } = await params;
  const [view, archive] = await Promise.all([getContestView(slug), getContestArchive()]);
  if (!view) notFound();
  return <ContestPage view={view} archive={archive.filter((contest) => contest.id !== view.contest.id && contest.phase === 'results')} />;
}
