'use client';

import React from 'react';
import { recordFlagView } from '@/actions/flag-views';

// Flags counted during this page load, so React's dev double-mount and re-renders
// don't count the same visit twice.
const counted = new Set<string>();

const SEEN_KEY = 'vx:flag-views-seen';
const MAX_SEEN = 500;

/**
 * Whether this browser views the flag for the first time today (UTC), remembering it if so.
 * Kept here instead of in Redis because Upstash bills every command.
 */
function markSeenToday(flagId: string) {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as { day?: string; ids?: string[] } | null;
    const ids = stored?.day === day && Array.isArray(stored.ids) ? stored.ids : [];
    if (ids.includes(flagId)) return false;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ day, ids: [...ids, flagId].slice(-MAX_SEEN) }));
    return true;
  } catch {
    // Storage blocked: count the view without counting a visitor.
    return false;
  }
}

/** Records a view once the flag page has loaded in a real browser. */
export default function FlagViewTracker({ flagId }: { flagId: string }) {
  React.useEffect(() => {
    if (counted.has(flagId)) return;
    counted.add(flagId);
    recordFlagView(flagId, markSeenToday(flagId)).catch(() => counted.delete(flagId));
  }, [flagId]);

  return null;
}
