import { Suspense } from 'react';
import type { Metadata } from 'next';

import ExperimentalFlagSearch from '@/components/ExperimentalFlagSearch';

export const metadata: Metadata = {
  title: 'Experimental Flag Search - Vexilo',
  description:
    'Explore a smarter experimental search for flags using fuzzy names, tags, and AI-generated flag metadata.',
};

export default function ExperimentalSearchPage() {
  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-16 md:px-8'>
      <Suspense
        fallback={
          <div className='pt-7'>
            <div className='mb-6 h-8 w-48 animate-pulse rounded-lg bg-foreground/[0.06]' />
            <div className='mb-6 h-12 animate-pulse rounded-[13px] bg-foreground/[0.06]' />
          </div>
        }
      >
        <ExperimentalFlagSearch />
      </Suspense>
    </div>
  );
}
