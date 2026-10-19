'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eyedropper, Plus } from '@/components/icons';
import { cn } from '@/lib/utils';
import { FLAG_COLORS, normalizeHex, sameColor } from './colors';
import { ReferencePalette } from './ReferencePalette';

export function Swatch({
  color,
  active,
  size = 28,
  className,
  ...props
}: { color: string; active?: boolean; size?: number } & React.ComponentProps<'button'>) {
  return (
    <button
      type='button'
      className={cn(
        'shrink-0 cursor-pointer rounded-[8px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.16)] outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring',
        active && 'ring-2 ring-main ring-offset-2 ring-offset-surface',
        className,
      )}
      style={{ background: color, width: size, height: size }}
      {...props}
    />
  );
}

/** A range input that records one undo step per drag. */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  className,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit: () => void;
  className?: string;
  label: string;
}) {
  return (
    <input
      type='range'
      aria-label={label}
      className={cn('studio-range w-full', className)}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      onBlur={onCommit}
    />
  );
}

export function ToolButton({
  label,
  active,
  className,
  children,
  side = 'top',
  ...props
}: { label: string; active?: boolean; side?: 'top' | 'bottom' | 'left' | 'right' } & React.ComponentProps<'button'>) {
  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>
        <button
          type='button'
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'inline-flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-2 text-[13px] font-medium text-subtle outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[17px]',
            active && 'bg-main-soft text-main hover:bg-main-soft hover:text-main',
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export const ToolDivider = () => <span className='mx-0.5 h-5 w-px shrink-0 bg-line' />;

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/** Flag colours, the flag's own colours and a custom picker. Live changes; `onCommit` when done. */
export function ColorPicker({
  value,
  documentColors,
  onChange,
  onCommit,
}: {
  value: string;
  documentColors: string[];
  onChange: (color: string) => void;
  onCommit: () => void;
}) {
  const [draft, setDraft] = React.useState(value.toUpperCase());
  const [tab, setTab] = React.useState<'swatches' | 'flag'>('swatches');
  React.useEffect(() => setDraft(value.toUpperCase()), [value]);
  const pick = (color: string) => {
    onChange(color);
    onCommit();
  };
  const EyeDropper = typeof window !== 'undefined' ? (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper : undefined;

  return (
    <div className='-m-1.5 flex max-h-[min(520px,var(--radix-popover-content-available-height,70dvh))] w-[248px] flex-col gap-3 overflow-y-auto p-1.5'>
      <div className='flex items-center gap-2'>
        <label className='relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.16)]' style={{ background: value }}>
          <input
            type='color'
            aria-label='Custom colour'
            value={value.toLowerCase()}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            onBlur={onCommit}
            className='absolute inset-0 size-full cursor-pointer opacity-0'
          />
        </label>
        <input
          aria-label='Hex'
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
          onBlur={() => {
            setDraft(value.toUpperCase());
            onCommit();
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className='vx-well h-9 min-w-0 flex-1 rounded-[10px] px-3 font-mono text-[13px] uppercase outline-none focus:ring-2 focus:ring-ring'
        />
        {EyeDropper && (
          <ToolButton
            label='Pick from screen'
            onClick={async () => {
              try {
                const { sRGBHex } = await new EyeDropper().open();
                const hex = normalizeHex(sRGBHex);
                if (hex) pick(hex);
              } catch {
                // Cancelled.
              }
            }}
          >
            <Eyedropper />
          </ToolButton>
        )}
      </div>
      {documentColors.length > 0 && (
        <div className='flex flex-wrap gap-1.5 border-b border-line pb-3'>
          {documentColors.map((color) => (
            <Swatch key={color} color={color} size={24} active={sameColor(color, value)} aria-label={color} onClick={() => pick(color)} />
          ))}
        </div>
      )}
      <div className='flex gap-1 rounded-[9px] bg-well p-1' role='group' aria-label='Colour source'>
        {(['swatches', 'flag'] as const).map((source) => <button key={source} type='button' aria-pressed={tab === source} onClick={() => setTab(source)} className={cn('flex-1 cursor-pointer rounded-[6px] px-2 py-1.5 text-xs font-medium', tab === source ? 'bg-popover shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>{source === 'swatches' ? 'Swatches' : 'From a flag'}</button>)}
      </div>
      {tab === 'flag' ? <ReferencePalette value={value} onPick={pick} /> : <div className='grid grid-cols-6 gap-1.5'>
        {FLAG_COLORS.map((color) => (
          <Swatch key={color} color={color} size={34} active={sameColor(color, value)} aria-label={color} onClick={() => pick(color)} />
        ))}
      </div>}
    </div>
  );
}

export function AddSwatch(props: React.ComponentProps<'label'> & { onPick: (color: string) => void }) {
  const { onPick, className, ...rest } = props;
  return (
    <label className={cn('relative grid size-7 cursor-pointer place-items-center rounded-[8px] text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]', className)} {...rest}>
      <Plus className='size-3.5' />
      <input type='color' className='absolute inset-0 cursor-pointer opacity-0' onChange={(e) => onPick(e.target.value.toUpperCase())} />
    </label>
  );
}
