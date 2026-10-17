'use client';

import React from 'react';
import { recordFlagView } from '@/actions/flag-views';

// Flags counted during this page load, so React's dev double-mount and re-renders
// don't count the same visit twice.
const counted = new Set<string>();

/** Records a view once the flag page has loaded in a real browser. */
export default function FlagViewTracker({ flagId }: { flagId: string }) {
  React.useEffect(() => {
    if (counted.has(flagId)) return;
    counted.add(flagId);
    recordFlagView(flagId).catch(() => counted.delete(flagId));
  }, [flagId]);

  return null;
}
