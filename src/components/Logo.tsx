'use client';

import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { SvgLogo } from './svg-logo';

export default function Logo({
  showText = false,
  textClassName = '',
}: {
  showText?: boolean;
  textClassName?: string;
}) {
  const router = useRouter();

  const handleLogoClick = () => {
    // Clear URL parameters and navigate to home
    router.replace('/');
  };

  return (
    <button
      onClick={handleLogoClick}
      className='flex gap-3 cursor-pointer items-center justify-center group'
    >
      <div className='relative'>
        <SvgLogo className='w-11 h-11 transition-transform duration-200 group-hover:scale-105' />
      </div>
      <div
        className={cn(
          'hidden md:flex flex-col items-start leading-none',
          showText && 'flex',
          textClassName,
        )}
      >
        <span
          className='text-[1.75rem] font-bold italic tracking-wide text-foreground transition-colors'
          style={{ fontFamily: 'Times New Roman, serif' }}
        >
          VEXILO
        </span>
        <span className='text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground/70'>
          Flag Encyclopedia
        </span>
      </div>
    </button>
  );
}
