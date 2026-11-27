'use client';

import React from 'react';
import { recordPostView } from '@/actions/flag-views';

const counted = new Set<string>();
const SEEN_KEY = 'vx:post-views-seen';
const MAX_SEEN = 500;

/** Whether this browser views the post for the first time today (UTC), remembering it if so. */
function markSeenToday(postId: string) {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as { day?: string; ids?: string[] } | null;
    const ids = stored?.day === day && Array.isArray(stored.ids) ? stored.ids : [];
    if (ids.includes(postId)) return false;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ day, ids: [...ids, postId].slice(-MAX_SEEN) }));
    return true;
  } catch {
    return false;
  }
}

/** Counts a view once the post's page has loaded in a real browser. */
export default function PostViewTracker({ postId }: { postId: string }) {
  React.useEffect(() => {
    if (counted.has(postId)) return;
    counted.add(postId);
    const unique = markSeenToday(postId);
    if (unique) recordPostView(postId).catch(() => counted.delete(postId));
  }, [postId]);
  return null;
}
