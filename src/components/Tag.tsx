'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import React from 'react';

interface TagProps {
  text: string;
  className?: string;
  count?: number;
  onClick?: () => void;
  isActive?: boolean;
  /** `chip` is the raised filter style used on browse; `outline` is the quiet pill used on flag pages. */
  variant?: 'chip' | 'outline';
}

export default function Tag({
  text,
  className,
  count,
  onClick,
  isActive: isActiveProp,
  variant = 'outline',
}: TagProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isActive = isActiveProp || searchParams.get('tag') === text;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    e.preventDefault();
    const params = new URLSearchParams(window.location.pathname === '/' ? searchParams : undefined);
    params.set('tag', text);
    params.delete('page');
    if (window.location.pathname !== '/') {
      router.push(`/?${params.toString()}`);
    } else {
      router.replace(`/?${params.toString()}`, { scroll: false });
    }
  };

  if (variant === 'chip') {
    return (
      <button
        type='button'
        onClick={handleClick}
        aria-pressed={isActive}
        className={cn(
          'inline-flex h-8 shrink-0 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-[color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive ? 'bg-foreground text-background' : 'vx-key text-subtle hover:text-foreground',
          className,
        )}
      >
        {text}
        {count !== undefined && (
          <span className={cn('tabular-nums text-[11px]', isActive ? 'opacity-60' : 'text-muted-foreground')}>
            {count.toLocaleString()}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type='button'
      onClick={handleClick}
      aria-label={`Filter by tag ${text}`}
      className={cn(
        'inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium shadow-[inset_0_0_0_1px_var(--border)] transition-[color,box-shadow] hover:text-foreground hover:shadow-[inset_0_0_0_1px_var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'text-foreground shadow-[inset_0_0_0_1px_var(--foreground)]' : 'text-subtle',
        className,
      )}
    >
      {text}
      {count !== undefined && <span className='tabular-nums text-[11px] text-muted-foreground'>{count}</span>}
    </button>
  );
}
