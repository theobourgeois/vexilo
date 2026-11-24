'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Roughly how much history shows before "Read more". Cut at paragraph ends, never mid-sentence. */
const PREVIEW_CHARS = 1100;

/**
 * A flag's history, split into its paragraphs. Long ones open on their first few paragraphs, and
 * `columns` flows the text into two columns on wide screens so it fills the width without long lines.
 */
export default function HistoryText({ text, columns }: { text: string; columns?: boolean }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const [expanded, setExpanded] = useState(false);

  let previewCount = 0;
  for (let length = 0; previewCount < paragraphs.length && (previewCount === 0 || length < PREVIEW_CHARS); previewCount++)
    length += paragraphs[previewCount].length;
  // Not worth hiding a single short paragraph.
  const collapsible = previewCount < paragraphs.length && text.length > PREVIEW_CHARS * 1.3;
  const shown = collapsible && !expanded ? paragraphs.slice(0, previewCount) : paragraphs;

  return (
    <div>
      <div
        className={cn(
          'text-[15px] leading-relaxed text-subtle [&>p+p]:mt-4',
          columns && 'lg:columns-2 lg:gap-14',
        )}
      >
        {shown.map((paragraph, i) => (
          <p key={i} className='whitespace-pre-line'>
            {paragraph}
          </p>
        ))}
      </div>
      {collapsible && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className='mt-3 cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground'
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
