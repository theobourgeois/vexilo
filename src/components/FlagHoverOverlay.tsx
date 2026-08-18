'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type FlagHoverOverlayProps = {
  open: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
};

type Coords = {
  left: number;
  top: number;
};

function getPreviewCoords(
  trigger: HTMLElement,
  preview: HTMLElement,
): Coords {
  const anchor = trigger.getBoundingClientRect();
  const width = preview.offsetWidth;
  const height = preview.offsetHeight;
  const gap = 12;
  const padding = 16;

  const canPlaceRight =
    anchor.right + gap + width <= window.innerWidth - padding;
  let left = canPlaceRight ? anchor.right + gap : anchor.left - gap - width;
  left = Math.min(
    Math.max(padding, left),
    Math.max(padding, window.innerWidth - width - padding),
  );

  let top = anchor.top + (anchor.height - height) / 2;
  top = Math.min(
    Math.max(padding, top),
    Math.max(padding, window.innerHeight - height - padding),
  );

  return { left: Math.round(left), top: Math.round(top) };
}

export default function FlagHoverOverlay({
  open,
  triggerRef,
  children,
}: FlagHoverOverlayProps) {
  const previewRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [coords, setCoords] = React.useState<Coords | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    const preview = previewRef.current;
    if (!trigger || !preview) {
      return;
    }

    const next = getPreviewCoords(trigger, preview);
    setCoords((current) => {
      if (current && current.left === next.left && current.top === next.top) {
        return current;
      }
      return next;
    });
  }, [triggerRef]);

  React.useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      setVisible(false);
      return;
    }

    updatePosition();
    const preview = previewRef.current;
    const observer =
      preview !== null ? new ResizeObserver(() => updatePosition()) : null;
    if (preview && observer) {
      observer.observe(preview);
    }

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition, children]);

  React.useEffect(() => {
    if (!coords) {
      setVisible(false);
      return;
    }
    if (visible) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [coords, visible]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      ref={previewRef}
      data-flag-hover-preview=''
      style={{
        left: coords?.left ?? 0,
        top: coords?.top ?? 0,
        visibility: coords ? 'visible' : 'hidden',
      }}
      className='pointer-events-none fixed z-50 w-[340px]'
    >
      <div
        className={cn(
          'rounded-2xl border border-white/90 bg-[image:var(--background-image-noise),var(--background-image-glossy-card)] bg-[size:256px,auto] p-3 text-foreground shadow-[0_24px_64px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl dark:border-white/15 dark:bg-[image:var(--background-image-noise),var(--background-image-glossy-card-dark)] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.55)]',
          coords && visible
            ? 'origin-center animate-in fade-in-0 zoom-in-95 duration-300 fill-mode-both'
            : 'opacity-0',
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
