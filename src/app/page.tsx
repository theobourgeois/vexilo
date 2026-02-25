import { Suspense } from 'react';
import FlagSearch from '../components/FlagSearch';
import { HomeHighlights } from '@/components/home-highlights';
import { ProfileFlagAlert } from '@/components/alert-banner';

export default function Home() {
  return (
    <div className='min-h-screen bg-main/10 dark:bg-transparent pt-0'>
      <div className='pb-4'>
        <ProfileFlagAlert />
      </div>

      <div className='max-w-7xl mx-auto px-4 mb-4'>
        <HomeHighlights />
      </div>

      {/* Search and Results */}
      <div className='max-w-7xl mx-auto px-4 pb-12'>
        <Suspense
          fallback={
            <div className='space-y-6'>
              <div className='animate-pulse'>
                <div className='h-20 bg-secondary-background rounded-lg mb-6'></div>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className='animate-pulse'>
                    <div className='h-48 bg-secondary-background rounded-lg'></div>
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <FlagSearch />
        </Suspense>
      </div>
    </div>
  );
}
