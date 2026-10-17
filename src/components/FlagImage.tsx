'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Flag as FlagIcon } from '@/components/icons';

const DEFAULT_RATIO = 1.5;

const ratioCache = new Map<string, number>();

export type FlagImageProps = {
  src: string;
  alt: string;
  /** Max rendered height in px. */
  maxHeight: number;
  /**
   * Target flag area in px². Flags of different proportions get the same amount of
   * surface, so tall flags render tall and long flags render long. Defaults to a 3:2 flag at maxHeight.
   */
  area?: number;
  /** Render at exactly maxHeight instead of fitting the stage. */
  fixed?: boolean;
  eager?: boolean;
  className?: string;
};

/**
 * A flat flag at its true proportions. Inside a `.flag-stage` it shrinks to fit the stage.
 * The hairline edge is a drop-shadow, so it follows the flag's shape (Nepal, pennants)
 * instead of drawing a box around transparent corners.
 */
export default function FlagImage({
  src,
  alt,
  maxHeight,
  area,
  fixed,
  eager,
  className,
}: FlagImageProps) {
  const [ratio, setRatio] = React.useState<number | null>(() => ratioCache.get(src) ?? null);
  const [failed, setFailed] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const measure = React.useCallback(
    (img: HTMLImageElement) => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const next = w > 0 && h > 0 ? w / h : DEFAULT_RATIO;
      ratioCache.set(src, next);
      setRatio(next);
    },
    [src],
  );

  React.useEffect(() => {
    const cached = ratioCache.get(src);
    if (cached) {
      setRatio(cached);
      return;
    }
    setRatio(null);
    setFailed(false);
    const img = imgRef.current;
    // The image may have finished loading before hydration attached onLoad.
    if (img?.complete && img.naturalWidth > 0) measure(img);
  }, [src, measure]);

  const style = {
    '--r': ratio ?? DEFAULT_RATIO,
    '--hmax': `${maxHeight}px`,
    '--area': area ?? Math.round(maxHeight * maxHeight * DEFAULT_RATIO),
  } as React.CSSProperties;

  if (failed) {
    return (
      <div
        className={cn('flag-img grid place-items-center rounded-[3px] text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]', fixed && 'flag-img--fixed', className)}
        style={style}
        role='img'
        aria-label={`${alt} (image unavailable)`}
      >
        <FlagIcon className='size-6 opacity-60' />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- flags come from arbitrary hosts and need natural dimensions
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      decoding='async'
      onLoad={(e) => measure(e.currentTarget)}
      onError={() => setFailed(true)}
      data-ready={ratio ? 'true' : 'false'}
      className={cn('flag-img', fixed && 'flag-img--fixed', className)}
      style={style}
    />
  );
}
