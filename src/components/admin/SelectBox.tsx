'use client';

import { cn } from '@/lib/utils';
import { Check, Minus } from 'lucide-react';

type SelectBoxProps = {
  checked: boolean | 'mixed';
  onToggle: (event: React.MouseEvent) => void;
  label: string;
  className?: string;
};

function boxClassName(active: boolean, className?: string) {
  return cn(
    'size-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer',
    active
      ? 'bg-main border-[oklch(50%_0.15_259)] text-white'
      : 'bg-secondary-background border-foreground/25 hover:border-foreground/50',
    className,
  );
}

/** Visual-only checkbox for rows that are already clickable buttons. */
export function SelectBoxIndicator({ checked, className }: Pick<SelectBoxProps, 'checked' | 'className'>) {
  return (
    <span aria-hidden className={boxClassName(checked !== false, className)}>
      {checked === true && <Check className='size-3.5' strokeWidth={3} />}
      {checked === 'mixed' && <Minus className='size-3.5' strokeWidth={3} />}
    </span>
  );
}

export function SelectBox({ checked, onToggle, label, className }: SelectBoxProps) {
  const active = checked === true || checked === 'mixed';
  return (
    <button
      type='button'
      role='checkbox'
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(event);
      }}
      className={boxClassName(active, className)}
    >
      {checked === true && <Check className='size-3.5' strokeWidth={3} />}
      {checked === 'mixed' && <Minus className='size-3.5' strokeWidth={3} />}
    </button>
  );
}
