'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const MAX_HEIGHT = 100; // ~4 lines

export default function ExpandableDescription({
  description,
}: {
  description: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsClamped(el.scrollHeight > MAX_HEIGHT);
    }
  }, [description]);

  return (
    <div>
      <p
        ref={textRef}
        className={cn(
          'text-[15px] leading-relaxed text-subtle',
          !isExpanded && isClamped && 'line-clamp-4',
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
