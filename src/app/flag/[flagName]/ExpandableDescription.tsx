'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const LINE_HEIGHT = 25;

export default function ExpandableDescription({
  description,
  lines = 4,
}: {
  description: string;
  /** Lines shown before "See more". */
  lines?: 4 | 8;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsClamped(el.scrollHeight > lines * LINE_HEIGHT);
    }
  }, [description, lines]);

  return (
    <div>
      <p
        ref={textRef}
        className={cn(
          'whitespace-pre-line text-[15px] leading-relaxed text-subtle',
          !isExpanded && isClamped && (lines === 8 ? 'line-clamp-[8]' : 'line-clamp-4'),
        )}
      >
        {description}
      </p>
      {isClamped && (
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className='mt-1.5 cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground'
        >
          {isExpanded ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  );
}
