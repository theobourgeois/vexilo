import type { Metadata } from 'next';
import Studio from '@/components/studio/Studio';
import { getRemixSource, getStudioEmblems } from '@/lib/studio-data';

export const metadata: Metadata = {
  title: 'Flag maker - Vexilo',
  description: 'Design your own flag or remix any flag on Vexilo, with hundreds of emblems from real flags.',
};

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ remix?: string }> }) {
  const { remix } = await searchParams;
  const [emblems, source] = await Promise.all([getStudioEmblems(), remix ? getRemixSource(remix) : null]);
  return <Studio key={source?.id ?? 'new'} emblems={emblems} remix={source} />;
}
