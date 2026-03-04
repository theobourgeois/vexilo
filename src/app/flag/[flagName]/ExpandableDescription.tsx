'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const MAX_HEIGHT = 72; // ~3 lines of text at text-lg

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
    <div className='max-w-3xl mx-auto'>
      <p
        ref={textRef}
        className={cn(
          'text-lg text-muted-foreground transition-all',
          !isExpanded && isClamped && 'line-clamp-3',
        )}
      >
        {description}
      </p>
      {isClamped && (
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className='text-sm text-muted-foreground hover:text-foreground mt-1 cursor-pointer underline underline-offset-2'
        >
          {isExpanded ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  );
}
