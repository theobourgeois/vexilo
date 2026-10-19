import { Shuffle, Sparkles } from '@/components/icons';
import { CUSTOM_TAG, REMIX_TAG } from '@/lib/studio-design';
import { cn } from '@/lib/utils';

/** Marks flags made in the flag maker, so remixes and custom designs never pass as official. */
export function MakerBadge({ tags, className }: { tags?: string[]; className?: string }) {
  const kind = tags?.includes(REMIX_TAG) ? 'Remix' : tags?.includes(CUSTOM_TAG) ? 'Custom' : null;
  if (!kind) return null;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full bg-[rgb(225_120_50/0.13)] px-2.5 text-[12px] font-semibold text-[#b4541d] dark:bg-[rgb(240_163_107/0.14)] dark:text-[#f0a36b]',
        className,
      )}
    >
      {kind === 'Remix' ? <Shuffle className='size-3' /> : <Sparkles className='size-3' />}
      {kind}
    </span>
  );
}
