'use client';

import React from 'react';
import type { WavingFlag as WavingFlagHandle } from '@/lib/flag-cloth';
import { cn } from '@/lib/utils';

/** A flag waving on a pole, rendered with three.js. The engine loads only when shown. */
export default function WavingFlag({
  src,
  alt,
  wind = 1,
  texture,
  className,
}: {
  src: string;
  alt: string;
  wind?: number;
  /** A same-origin image to wave as-is, instead of fetching `src` through the texture route. */
  texture?: string;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const flagRef = React.useRef<WavingFlagHandle | null>(null);
  const windRef = React.useRef(wind);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    setState('loading');

    import('@/lib/flag-cloth').then(({ createWavingFlag }) => {
      if (cancelled) return;
      flagRef.current = createWavingFlag(container, texture ?? `/api/flag-texture?src=${encodeURIComponent(src)}`, {
        wind: windRef.current,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onReady: () => !cancelled && setState('ready'),
        onError: () => !cancelled && setState('error'),
      });
    });

    return () => {
      cancelled = true;
      flagRef.current?.dispose();
      flagRef.current = null;
    };
  }, [src, texture]);

  React.useEffect(() => {
    windRef.current = wind;
    flagRef.current?.setWind(wind);
  }, [wind]);

  return (
    <div
      ref={containerRef}
      role='img'
      aria-label={`${alt}, waving`}
      className={cn('relative cursor-grab active:cursor-grabbing', className)}
    >
      {state !== 'ready' && (
        <p className='absolute inset-0 grid place-items-center text-[13px] text-muted-foreground'>
          {state === 'error' ? 'This flag can’t be waved.' : 'Raising the flag…'}
        </p>
      )}
    </div>
  );
}
