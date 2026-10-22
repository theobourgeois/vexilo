import { cn } from '@/lib/utils';

const STRIPES = ['#13894A', '#FFFFFF', '#D52B1E'];
/** Which of the 24 tiles the Unfurl art shows uncovered. */
const UNCOVERED = new Set([0, 5, 6, 11, 12, 13, 18, 23]);
const FILLED = new Set([0, 4, 5, 7]);

/** A half-unfurled flag, sized by its height. */
export function UnfurlArt({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid aspect-[3/2] h-[104px] grid-cols-6 grid-rows-4 overflow-hidden rounded-[3px] shadow-[0_0_0_0.6px_rgb(28_29_31/0.45),0_8px_12px_rgb(28_29_31/0.13)]',
        className,
      )}
    >
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className={cn(!UNCOVERED.has(i) && 'bg-raised shadow-[inset_0_0_0_0.5px_var(--line)]')}
          style={UNCOVERED.has(i) ? { background: STRIPES[Math.floor((i % 6) / 2)] } : undefined}
        />
      ))}
    </div>
  );
}

/** A part-filled three-by-three board. */
export function GridArt({ small }: { small?: boolean }) {
  return (
    <div className={cn('grid grid-cols-3', small ? 'gap-[3px]' : 'gap-1.5')}>
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={cn(
            small ? 'size-[14px] rounded-[4px]' : 'size-[34px] rounded-[8px]',
            FILLED.has(i) ? 'bg-good-soft shadow-[inset_0_0_0_1.5px_var(--good)]' : 'vx-key',
          )}
        />
      ))}
    </div>
  );
}
