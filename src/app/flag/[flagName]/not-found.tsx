import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Flag } from '@/components/icons';

export default function NotFound() {
  return (
    <div className='mx-auto max-w-[760px] px-4 pb-16 pt-7 md:px-8'>
      <div className='vx-tile overflow-hidden'>
        <div className='bg-stage grid h-[220px] place-items-center border-b border-line'>
          <div className='vx-well grid h-[92px] w-[138px] place-items-center rounded-[10px] text-muted-foreground'>
            <Flag className='size-7' />
          </div>
        </div>
        <div className='p-6 sm:p-[26px]'>
          <span className='vx-label'>404</span>
          <h1 className='mt-2 text-[22px] font-semibold tracking-[-0.03em]'>Flag not found</h1>
          <p className='mt-1.5 max-w-[52ch] text-subtle'>
            There is no flag with this name in the collection. It may have been renamed or removed.
          </p>
          <div className='mt-5 flex flex-wrap gap-2'>
            <Button asChild>
              <Link href='/'>
                Browse flags
                <ArrowRight />
              </Link>
            </Button>
            <Button variant='neutral' asChild>
              <Link href='/post-flag'>Submit a flag</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
