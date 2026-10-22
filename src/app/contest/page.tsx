import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContestArchive, getCurrentContest } from '@/actions/contests';
import { Palette } from '@/components/icons';
import FlagImage from '@/components/FlagImage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Design contest - Vexilo',
  description: 'A monthly flag design contest on Vexilo. Design a flag for the theme, vote for your favourites, and see who wins.',
};

/** Goes to whichever contest is current; with none, lists past ones. */
export default async function ContestIndex() {
  const current = await getCurrentContest();
  if (current) redirect(`/contest/${current.slug}`);
  const archive = await getContestArchive();

  return (
    <div className='mx-auto max-w-[1100px] px-4 pb-24 md:px-8'>
      <div className='pb-[18px] pt-7'>
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Design contest</h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>A new theme every month. Design a flag, vote for your favourites.</p>
      </div>
      {archive.length === 0 ? (
        <div className='vx-tile flex flex-col items-center gap-2 p-12 text-center'>
          <Palette className='size-7 text-muted-foreground' />
          <p className='text-[15px] font-semibold'>The first contest is on its way</p>
          <p className='text-[13.5px] text-subtle'>Check back soon, or practise in the flag maker.</p>
          <Link href='/create' className='mt-2 text-[13.5px] font-medium text-main hover:underline'>
            Open the flag maker
          </Link>
        </div>
      ) : (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {archive.map((contest) => (
            <Link key={contest.id} href={`/contest/${contest.slug}`} className='vx-tile overflow-hidden transition-[box-shadow] duration-300 hover:shadow-tile-hover'>
              <div className='flag-stage grid h-[120px] place-items-center bg-stage p-5'>
                {contest.winner && <FlagImage src={contest.winner.image} alt={contest.winner.title} maxHeight={70} area={110 * 70} />}
              </div>
              <div className='p-3.5'>
                <span className='block text-[11.5px] text-muted-foreground'>{contest.title}</span>
                <span className='block truncate text-[14px] font-medium'>{contest.theme}</span>
                {contest.winner && <span className='mt-0.5 block truncate text-[12.5px] text-subtle'>Won by {contest.winner.designer}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
