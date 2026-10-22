import { cn } from '@/lib/utils';

/** The shared look of the cards in the Today row on Browse. */
export const TODAY_CARD =
  'vx-tile group flex h-[60px] min-w-0 items-center gap-3 p-2 pr-3.5 text-left transition-[box-shadow] duration-300 hover:shadow-tile-hover data-[state=open]:shadow-tile-hover';

export const TODAY_THUMB = 'grid h-[44px] w-[62px] shrink-0 place-items-center overflow-hidden rounded-[9px] bg-stage';

export function TodayCardText({ label, title, className }: { label: React.ReactNode; title: React.ReactNode; className?: string }) {
  return (
    <span className={cn('min-w-0 flex-1', className)}>
      <span className='block truncate text-[11.5px] tabular-nums text-muted-foreground'>{label}</span>
      <span className='block truncate text-[14px] font-medium'>{title}</span>
    </span>
  );
}
