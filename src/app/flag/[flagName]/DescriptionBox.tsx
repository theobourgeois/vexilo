'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const FADE = '28px';
/** Up to this many lines show in full; a box that only hid a line or two would be more fuss than help. */
export const MAX_OPEN_LINES = 9;

/**
 * The flag's description in the hero. A longer one scrolls inside a box seven lines tall, so it never
 * pushes the actions down or pulls the flag off-centre. Its edges fade where there's more to scroll:
 * a mask rather than an overlay, because the band behind it is coloured per flag.
 */
export default function DescriptionBox({ text, long }: { text: string; long: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // The server guesses from the text so a long description renders boxed straight away; the real
  // overflow is measured once it's on screen.
  const [overflows, setOverflows] = useState(long);
  const [edges, setEdges] = useState({ top: false, bottom: long });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const textHeight = el.scrollHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const boxed = textHeight > MAX_OPEN_LINES * parseFloat(style.lineHeight) + 1;
    setOverflows(boxed);
    const scrollable = boxed && el.scrollHeight > el.clientHeight + 1;
    setEdges({
      top: scrollable && el.scrollTop > 1,
      bottom: scrollable && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, text]);

  const mask =
    edges.top || edges.bottom
      ? `linear-gradient(to bottom, ${edges.top ? 'transparent' : 'black'}, black ${FADE}, black calc(100% - ${FADE}), ${edges.bottom ? 'transparent' : 'black'})`
      : undefined;

  return (
    <div
      className={cn(
        overflows &&
          'rounded-[12px] bg-black/15 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]',
      )}
    >
      <div
        ref={ref}
        onScroll={measure}
        tabIndex={overflows ? 0 : undefined}
        role={overflows ? 'region' : undefined}
        aria-label={overflows ? 'Description' : undefined}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className={cn(
          'text-[15px] leading-relaxed text-subtle outline-none',
          overflows &&
            'max-h-[calc(7lh+1.25rem)] overflow-y-auto rounded-[12px] px-3.5 py-2.5 [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-white/40',
        )}
      >
        {/* pre-wrap, not pre-line: people paste text art, which falls apart when its spaces collapse. */}
        <p className='whitespace-pre-wrap break-words'>{text}</p>
      </div>
    </div>
  );
}
