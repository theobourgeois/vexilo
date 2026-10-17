import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SvgLogo } from './svg-logo';

export default function Logo({
  showText = true,
  textClassName = '',
}: {
  showText?: boolean;
  textClassName?: string;
}) {
  return (
    <Link href='/' className='group flex shrink-0 items-center gap-2.5'>
      <SvgLogo className='size-[34px] transition-transform duration-200 group-hover:scale-105' />
      {showText && (
        <span
          className={cn(
            'text-[18px] font-semibold tracking-[-0.03em] text-foreground',
            textClassName,
          )}
        >
          Vexilo
        </span>
      )}
    </Link>
  );
}
