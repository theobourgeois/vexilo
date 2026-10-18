'use client';

import React from 'react';
import type { FlagRecolorer } from '@/lib/flag-recolor';
import { cn } from '@/lib/utils';

/** A flat flag repainted in the browser, with palette colour i drawn as `colors[i]`. */
export default function CustomFlag({
  src,
  alt,
  palette,
  colors,
  canvasRef,
  maxHeight,
  area,
  className,
}: {
  src: string;
  alt: string;
  /** The flag's own colours, as read from its image. */
  palette: string[];
  colors: string[];
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  maxHeight: number;
  area: number;
  className?: string;
}) {
  const [recolorer, setRecolorer] = React.useState<FlagRecolorer | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const paletteKey = palette.join(',');

  React.useEffect(() => {
    let cancelled = false;
    setState('loading');
    setRecolorer(null);
    // The texture route serves the image same-origin, so its pixels can be read back.
    import('@/lib/flag-recolor')
      .then(({ createFlagRecolorer }) =>
        createFlagRecolorer(`/api/flag-texture?src=${encodeURIComponent(src)}`, paletteKey.split(',')),
      )
      .then(
        (next) => {
          if (cancelled) return;
          setRecolorer(next);
          setState('ready');
        },
        () => !cancelled && setState('error'),
      );
    return () => {
      cancelled = true;
    };
  }, [src, paletteKey]);

  // Colour pickers fire on every drag step, so repaint at most once a frame.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!recolorer || !canvas) return;
    const frame = requestAnimationFrame(() => {
      canvas.getContext('2d')?.putImageData(recolorer.render(colors), 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [recolorer, colors, canvasRef]);

  const style = {
    '--r': recolorer ? recolorer.width / recolorer.height : 1.5,
    '--hmax': `${maxHeight}px`,
    '--area': area,
  } as React.CSSProperties;

  return (
    <>
      <canvas
        ref={canvasRef}
        role='img'
        aria-label={`${alt}, custom colours`}
        width={recolorer?.width ?? 0}
        height={recolorer?.height ?? 0}
        data-ready={state === 'ready' ? 'true' : 'false'}
        className={cn('flag-img', className)}
        style={style}
      />
      {state !== 'ready' && (
        <p className='absolute inset-0 grid place-items-center text-[13px] text-muted-foreground'>
          {state === 'error' ? 'This flag’s colours can’t be changed.' : 'Mixing the paint…'}
        </p>
      )}
    </>
  );
}
