'use client';

import type { ReviewQueueItem } from '@/actions/requests';
import { Equal } from '@/components/icons';
import { diffLists, diffWords } from '@/lib/text-diff';
import { cn } from '@/lib/utils';

export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('tabular-nums text-xs font-medium text-muted-foreground mb-1.5', className)}>
      {children}
    </p>
  );
}

export function TextDiff({ before, after }: { before: string; after: string }) {
  return (
    <div className='text-sm rounded-[11px] bg-foreground/[0.03] border border-line px-3 py-2 leading-relaxed whitespace-pre-wrap'>
      {diffWords(before, after).map((part, index) => (
        <span
          key={index}
          className={cn(
            part.type === 'added' && 'bg-good-soft text-good rounded px-0.5',
            part.type === 'removed' && 'bg-bad-soft text-bad line-through decoration-bad/60 rounded px-0.5',
          )}
        >
          {part.text}
        </span>
      ))}
    </div>
  );
}

export function ChipList({ before, after }: { before: string[]; after: string[] }) {
  const { kept, added, removed } = diffLists(before, after);
  if (kept.length + added.length + removed.length === 0) {
    return <p className='text-sm text-muted-foreground'>None</p>;
  }
  return (
    <div className='flex flex-wrap gap-1.5'>
      {kept.map((value) => (
        <span key={`k-${value}`} className='text-xs font-medium rounded-full bg-foreground/[0.06] text-subtle px-2.5 py-1 break-all'>
          {value}
        </span>
      ))}
      {added.map((value) => (
        <span key={`a-${value}`} className='text-xs font-medium rounded-full bg-good-soft text-good px-2.5 py-1 break-all'>
          + {value}
        </span>
      ))}
      {removed.map((value) => (
        <span key={`r-${value}`} className='text-xs font-medium rounded-full bg-bad-soft text-bad line-through decoration-bad/60 px-2.5 py-1 break-all'>
          {value}
        </span>
      ))}
    </div>
  );
}

/** Field-by-field diff of an edit request: changed fields only, then a list of what stayed the same. */
export function EditDiff({
  before,
  after,
  labelClassName,
}: {
  before: NonNullable<ReviewQueueItem['oldFlag']>;
  after: ReviewQueueItem['flag'];
  labelClassName?: string;
}) {
  const unchanged: string[] = [];
  if ((before.sources ?? []).join() === (after.sources ?? []).join()) unchanged.push('sources');
  if ((before.relatedFlags ?? []).map((f) => f.id).join() === (after.relatedFlags ?? []).map((f) => f.id).join())
    unchanged.push('related flags');
  if ((before.tags ?? []).slice().sort().join() === (after.tags ?? []).slice().sort().join()) unchanged.push('tags');
  if ((before.description ?? '') === (after.description ?? '')) unchanged.push('description');

  return (
    <>
      {before.flagName !== after.flagName && (
        <div>
          <FieldLabel className={labelClassName}>Name</FieldLabel>
          <TextDiff before={before.flagName} after={after.flagName} />
        </div>
      )}
      {!unchanged.includes('tags') && (
        <div>
          <FieldLabel className={labelClassName}>Tags</FieldLabel>
          <ChipList before={before.tags ?? []} after={after.tags ?? []} />
        </div>
      )}
      {!unchanged.includes('description') && (
        <div>
          <FieldLabel className={labelClassName}>Description</FieldLabel>
          <TextDiff before={before.description ?? ''} after={after.description ?? ''} />
        </div>
      )}
      {!unchanged.includes('sources') && (
        <div>
          <FieldLabel className={labelClassName}>Sources</FieldLabel>
          <ChipList before={before.sources ?? []} after={after.sources ?? []} />
        </div>
      )}
      {!unchanged.includes('related flags') && (
        <div>
          <FieldLabel className={labelClassName}>Related flags</FieldLabel>
          <ChipList
            before={(before.relatedFlags ?? []).map((flag) => flag.name)}
            after={(after.relatedFlags ?? []).map((flag) => flag.name)}
          />
        </div>
      )}
      {unchanged.length > 0 && (
        <p className='flex items-center gap-2 text-xs text-muted-foreground'>
          <Equal className='size-3.5' />
          {unchanged.join(', ')} unchanged
        </p>
      )}
    </>
  );
}
