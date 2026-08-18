'use client';

import React from 'react';
import { createPortal } from 'react-dom';

const FADE_MS = 200;

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
  const [rendered, setRendered] = React.useState(false);
  const [coords, setCoords] = React.useState<Coords | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useLayoutEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    setRevealed(false);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      return;
    }
    if (!rendered) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setRendered(false);
      setCoords(null);
    }, FADE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [open, rendered]);

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
    if (!rendered || !open) {
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
  }, [open, rendered, updatePosition, children]);

  React.useEffect(() => {
    if (!open || !coords) {
      return;
    }

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setRevealed(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [open, coords]);

  if (!mounted || !rendered) {
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
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'scale(1)' : 'scale(0.97)',
          transition: `opacity ${FADE_MS}ms ease-out, transform ${FADE_MS}ms ease-out`,
        }}
        className='origin-center rounded-2xl border border-white/90 bg-[image:var(--background-image-noise),var(--background-image-glossy-card)] bg-[size:256px,auto] p-3 text-foreground shadow-[0_24px_64px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl dark:border-white/15 dark:bg-[image:var(--background-image-noise),var(--background-image-glossy-card-dark)] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.55)]'
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
