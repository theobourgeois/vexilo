'use client';

import React from 'react';
import { toast } from 'sonner';
import { localDate, untilTomorrow } from '@/lib/games/daily';
import { cn } from '@/lib/utils';

export function Stat({ icon, label, value, hot }: { icon: React.ReactNode; label: string; value: React.ReactNode; hot?: boolean }) {
  return (
    <span
      className={cn(
        'vx-well inline-flex h-[38px] items-center gap-2 rounded-[11px] px-3 text-[13px] text-subtle [&_svg]:size-[15px]',
        hot && '[&_svg]:text-main',
      )}
    >
      {icon}
      <span className='hidden sm:inline'>{label}</span>
      <b className='tabular-nums text-[13px] font-semibold text-foreground'>{value}</b>
    </span>
  );
}

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

/** Fired after a save, so the nav and Browse can tell the moment a daily puzzle is done. */
const STORE_EVENT = 'vexilo-store';

export function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(STORE_EVENT));
  } catch {
    // Private browsing can refuse storage; the game still plays, it just won't remember.
  }
}

/** Shares a result with the system sheet on phones, or copies it everywhere else. */
export async function shareResult(text: string) {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // Dismissed; fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied your result');
  } catch {
    toast.error('Couldn’t copy your result');
  }
}

/** "Next puzzle in 5h 12m", kept current. */
export function Countdown({ label }: { label: string }) {
  const [left, setLeft] = React.useState<string | null>(null);
  React.useEffect(() => {
    const tick = () => setLeft(untilTomorrow());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!left) return null;
  return (
    <span className='tabular-nums text-[13px] text-muted-foreground'>
      {label} in <b className='font-semibold text-foreground'>{left}</b>
    </span>
  );
}

/** A random ID for this browser, so a player's grid answers are only counted once. */
export function playerId() {
  const key = 'vexilo-player';
  try {
    const id = localStorage.getItem(key) ?? crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const isDone = (prefix: string) => !!readStore<{ counted?: boolean }>(`${prefix}-${localDate()}`, {}).counted;

/** Re-runs `check` after mount and whenever a game saves. */
function useStored(check: () => boolean) {
  const [value, setValue] = React.useState(false);
  const checkRef = React.useRef(check);
  checkRef.current = check;
  React.useEffect(() => {
    const update = () => setValue(checkRef.current());
    update();
    window.addEventListener(STORE_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(STORE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return value;
}

/** Whether today's puzzle is finished, from what the game saved under `prefix`. */
export function useDoneToday(prefix?: string) {
  return useStored(() => !!prefix && isDone(prefix));
}

/** Whether today's Unfurl or Vexigrid is still unplayed, for the dot on the Play link. */
export function useDailyPending() {
  return useStored(() => !isDone('vexilo-unfurl') || !isDone('vexilo-grid'));
}

/** The small red dot on the Play link while a daily puzzle is waiting. */
export function PendingDot({ className }: { className?: string }) {
  return <span aria-label='New puzzles today' className={cn('size-1.5 rounded-full bg-bad', className)} />;
}
