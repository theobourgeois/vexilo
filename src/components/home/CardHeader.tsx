import Link from 'next/link';
import { ArrowRight } from '@/components/icons';

/** A home card's top line: plain title, a muted date or period, and a muted link on the right. */
export function CardHeader({ title, when, link, right }: { title: string; when?: string; link?: { href: string; label: string }; right?: React.ReactNode }) {
  return (
    <div className='flex items-baseline gap-2 px-[18px] pb-2 pt-4'>
      <h2 className='text-[15px] font-semibold tracking-[-0.015em]'>{title}</h2>
      <span className='flex-1 truncate text-[12.5px] text-muted-foreground'>{when}</span>
      {right ??
        (link && (
          <Link href={link.href} className='inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-subtle hover:text-foreground'>
            {link.label} <ArrowRight className='size-3' />
          </Link>
        ))}
    </div>
  );
}

/** A section title on the home page, with a muted note and a "see all" button. */
export function SectionHeader({ title, note, link }: { title: string; note?: string; link: { href: string; label: string } }) {
  return (
    <div className='mb-4 mt-10 flex flex-wrap items-center gap-x-3 gap-y-1'>
      <h2 className='text-[20px] font-semibold tracking-[-0.025em]'>{title}</h2>
      {note && <span className='vx-label'>{note}</span>}
      <span className='flex-1' />
      <Link
        href={link.href}
        className='vx-key inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/[0.04]'
      >
        {link.label} <ArrowRight className='size-3.5' />
      </Link>
    </div>
  );
}
