import { Suspense } from 'react';
import FlagSearch from '../components/FlagSearch';
import { ProfileFlagAlert } from '@/components/alert-banner';

export default function Home() {
  return (
    <div className='mx-auto max-w-[1312px] px-4 md:px-8'>
      <ProfileFlagAlert />
      <Suspense
        fallback={
          <div className='pt-7'>
            <div className='mb-6 h-8 w-48 animate-pulse rounded-lg bg-foreground/[0.06]' />
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className='vx-tile h-[292px] animate-pulse' />
              ))}
            </div>
          </div>
        }
      >
        <FlagSearch />
      </Suspense>
    </div>
  );
}
