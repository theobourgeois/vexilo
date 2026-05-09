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
    <Suspense fallback={null}>
      <ExperimentalFlagSearch />
    </Suspense>
  );
}
