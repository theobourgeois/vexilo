'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      role='radiogroup'
      aria-label={ariaLabel}
      className={cn('vx-well inline-flex gap-0.5 rounded-[11px] p-[3px]', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type='button'
            role='radio'
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-[30px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium text-subtle outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5',
              active && 'vx-key text-foreground',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
