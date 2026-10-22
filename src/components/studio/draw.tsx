'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, Cursor, PaintBrush, PenNib, Shapes, Text } from '@/components/icons';
import type { TextFont } from '@/lib/studio-design';
import { cn } from '@/lib/utils';
import { documentColors, EXPORT_WIDTH } from './model';
import { isLinear, SHAPE_PRESETS, shapePath, type ShapePreset, type ShapeStyle } from './shapes';
import { fontChoice, FONTS, previewFamily } from './text';
import { ColorPicker, Slider, ToolButton, ToolDivider, type Side } from './ui';
import type { Studio } from './use-studio';

export type ToolKind = 'select' | 'shape' | 'brush' | 'pen' | 'text';

/** The tool in hand, and how it paints. */
export type DrawSettings = ShapeStyle & {
  tool: ToolKind;
  /** Which of SHAPE_PRESETS the shape tool draws. */
  preset: string;
  brushColor: string;
  /** Fraction of flag height. */
  brushSize: number;
  font: TextFont;
  textColor: string;
};

export const DEFAULT_DRAW: DrawSettings = {
  tool: 'select',
  preset: 'star',
  fill: '#FCD116',
  filled: true,
  stroke: '#000000',
  strokeWidth: 0,
  brushColor: '#FFFFFF',
  brushSize: 0.012,
  font: 'inter',
  textColor: '#FFFFFF',
};

const TOOLS: { tool: ToolKind; label: string; icon: React.ReactNode }[] = [
  { tool: 'select', label: 'Select (V)', icon: <Cursor /> },
  { tool: 'shape', label: 'Shapes (U)', icon: <Shapes /> },
  { tool: 'pen', label: 'Pen (P)', icon: <PenNib /> },
  { tool: 'text', label: 'Text (T)', icon: <Text /> },
  { tool: 'brush', label: 'Brush (B)', icon: <PaintBrush /> },
];

export function ToolPicker({ tool, onChange }: { tool: ToolKind; onChange: (tool: ToolKind) => void }) {
  return (
    <div className='flex items-center gap-0.5' role='toolbar' aria-label='Tools'>
      {TOOLS.map((t) => (
        <ToolButton key={t.tool} label={t.label} side='bottom' active={tool === t.tool} onClick={() => onChange(t.tool)}>
          {t.icon}
        </ToolButton>
      ))}
    </div>
  );
}

/** A preset drawn as its own icon, from the same geometry the canvas uses. */
export function ShapeIcon({ preset, className }: { preset: ShapePreset; className?: string }) {
  const kind = preset.shape.kind;
  const shape = { ...preset.shape, fill: true, stroke: 0 };
  let [w, h] = [18, 18];
  if (kind === 'line') [w, h] = [22, 2.6];
  else if (kind === 'arrow') [w, h] = [21, 9];
  else if (kind === 'rect') [w, h] = [19, 13];
  return (
    <svg viewBox='-12 -12 24 24' aria-hidden className={cn('size-[18px]', className)}>
      <path d={shapePath(shape, w, h)} fill='currentColor' fillRule='evenodd' transform={isLinear(kind) ? 'rotate(-45)' : undefined} />
    </svg>
  );
}

/** A fill or stroke as a chip: solid for a fill, a ring for a stroke, struck through when off. */
function PaintChip({ color, on, ring }: { color: string; on: boolean; ring?: boolean }) {
  return (
    <span
      className='relative size-[18px] shrink-0 overflow-hidden rounded-[5px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.18)]'
      style={on ? (ring ? { boxShadow: `inset 0 0 0 4px ${color}, inset 0 0 0 5px rgb(0 0 0 / 0.18)` } : { background: color }) : undefined}
    >
      {!on && <span className='absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[#e5484d]' />}
    </span>
  );
}

/**
 * A fill or stroke: a chip that opens a picker, with a switch to turn it off. Picking a colour
 * turns it back on. `onColor` is live; the popover closing commits.
 */
export function PaintButton({
  studio,
  label,
  color,
  on,
  ring,
  onToggle,
  onColor,
  side = 'bottom',
  children,
}: {
  studio: Studio;
  label: string;
  color: string;
  on: boolean;
  ring?: boolean;
  /** Absent when it can't be turned off. */
  onToggle?: (on: boolean) => void;
  onColor: (color: string, transient: boolean) => void;
  side?: Side;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={(next) => (setOpen(next), !next && studio.history.commit())}>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label={label}
          className={cn(
            'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] px-2 text-[13px] font-medium text-subtle outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            open && 'bg-foreground/[0.06] text-foreground',
          )}
        >
          <PaintChip color={color} on={on} ring={ring} />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} sideOffset={10} className='w-auto p-3' onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className='flex w-[248px] flex-col gap-3'>
          {onToggle && (
            <label className='flex cursor-pointer items-center justify-between text-[13px] font-medium'>
              {label}
              <Switch checked={on} onCheckedChange={onToggle} />
            </label>
          )}
          {children}
          <ColorPicker
            value={color}
            documentColors={documentColors(studio.design)}
            onChange={(next) => onColor(next, true)}
            onCommit={studio.history.commit}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A font menu, each name shown in its own face. */
export function FontPicker({ value, onChange, side = 'bottom' }: { value: TextFont; onChange: (font: TextFont) => void; side?: Side }) {
  const [open, setOpen] = React.useState(false);
  const current = fontChoice(value);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          aria-label='Font'
          className={cn(
            'inline-flex h-8 w-[132px] shrink-0 cursor-pointer items-center justify-between gap-1 rounded-[9px] px-2 text-[13px] font-medium text-subtle outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            open && 'bg-foreground/[0.06] text-foreground',
          )}
        >
          <span className='truncate'>{current.label}</span>
          <ChevronDown className='size-3 shrink-0' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} sideOffset={10} align='start' className='w-56'>
        <DropdownMenuRadioGroup value={value} onValueChange={(id) => onChange(id as TextFont)}>
          {FONTS.map((f) => (
            <DropdownMenuRadioItem key={f.id} value={f.id} className='justify-between'>
              <span className='text-[16px]' style={{ fontFamily: open ? `${previewFamily(f.id)}, var(--font-sans)` : undefined }}>
                {f.id === 'cairo' ? 'عربي' : f.label}
              </span>
              <span className='text-[12px] text-muted-foreground'>{f.id === 'cairo' ? f.label : f.hint}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A width in flag units, shown in export pixels. */
export function WidthSlider({
  studio,
  label = 'Width',
  value,
  min = 0.002,
  max = 0.06,
  onChange,
}: {
  studio: Studio;
  label?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const pixels = Math.round((value * EXPORT_WIDTH * studio.design.ratio[0]) / studio.design.ratio[1]);
  return (
    <label className='flex flex-col gap-1'>
      <span className='flex justify-between text-[12.5px] text-subtle'>
        {label}
        <span className='tabular-nums text-muted-foreground'>{pixels} px</span>
      </span>
      <Slider label={label} min={min} max={max} step={0.0005} value={value} onChange={onChange} onCommit={studio.history.commit} />
    </label>
  );
}

function shiftHint(preset: ShapePreset) {
  if (preset.proportional) return 'Shift to stretch';
  if (isLinear(preset.shape.kind)) return 'Shift to snap the angle';
  return preset.shape.kind === 'rect' ? 'Shift for a square' : 'Shift to keep its shape';
}

function StrokeButton({ studio, draw, onChange }: { studio: Studio; draw: DrawSettings; onChange: (patch: Partial<DrawSettings>) => void }) {
  return (
    <PaintButton
      studio={studio}
      label='Stroke'
      ring
      color={draw.stroke}
      on={draw.strokeWidth > 0}
      onToggle={(on) => onChange({ strokeWidth: on ? 0.008 : 0, ...(!on && { filled: true }) })}
      onColor={(stroke) => onChange({ stroke, strokeWidth: draw.strokeWidth || 0.008 })}
    >
      {draw.strokeWidth > 0 && <WidthSlider studio={studio} value={draw.strokeWidth} onChange={(strokeWidth) => onChange({ strokeWidth })} />}
    </PaintButton>
  );
}

/** What the shape, pen, brush or text tool will paint with, under the toolbar. */
export function ToolOptions({
  studio,
  draw,
  onChange,
  className,
  style,
}: {
  studio: Studio;
  draw: DrawSettings;
  onChange: (patch: Partial<DrawSettings>) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (draw.tool === 'select') return null;
  const preset = SHAPE_PRESETS.find((p) => p.id === draw.preset) ?? SHAPE_PRESETS[0];
  const linear = isLinear(preset.shape.kind);
  return (
    <div className={cn('flex h-11 items-center gap-0.5 rounded-[13px] bg-surface p-[5px] shadow-pop', className)} style={style}>
      {draw.tool === 'text' ? (
        <>
          <FontPicker value={draw.font} onChange={(font) => onChange({ font })} />
          <ToolDivider />
          <PaintButton studio={studio} label='Colour' color={draw.textColor} on onColor={(textColor) => onChange({ textColor })} />
          <span className='px-2 text-[12.5px] text-muted-foreground'>Click the flag to type</span>
        </>
      ) : draw.tool === 'pen' ? (
        <>
          <PaintButton
            studio={studio}
            label='Fill'
            color={draw.fill}
            on={draw.filled}
            onToggle={(filled) => onChange({ filled, ...(!filled && !draw.strokeWidth && { strokeWidth: 0.008 }) })}
            onColor={(fill) => onChange({ fill, filled: true })}
          />
          <StrokeButton studio={studio} draw={draw} onChange={onChange} />
        </>
      ) : draw.tool === 'shape' ? (
        <>
          {SHAPE_PRESETS.map((p) => (
            <ToolButton
              key={p.id}
              label={`${p.label} (${shiftHint(p)})`}
              side='bottom'
              active={p.id === preset.id}
              onClick={() => onChange({ preset: p.id })}
              className='px-1.5'
            >
              <ShapeIcon preset={p} />
            </ToolButton>
          ))}
          <ToolDivider />
          <PaintButton
            studio={studio}
            label='Fill'
            color={draw.fill}
            on={linear || draw.filled}
            onToggle={linear ? undefined : (filled) => onChange({ filled, ...(!filled && !draw.strokeWidth && { strokeWidth: 0.008 }) })}
            onColor={(fill) => onChange({ fill, filled: true })}
          />
          <StrokeButton studio={studio} draw={draw} onChange={onChange} />
        </>
      ) : (
        <>
          <PaintButton studio={studio} label='Colour' color={draw.brushColor} on onColor={(brushColor) => onChange({ brushColor })} />
          <ToolDivider />
          <label className='flex items-center gap-2.5 px-2 text-[13px] font-medium text-subtle'>
            Size
            <Slider
              label='Brush size'
              className='w-32'
              min={0.002}
              max={0.08}
              step={0.0005}
              value={draw.brushSize}
              onChange={(brushSize) => onChange({ brushSize })}
              onCommit={() => undefined}
            />
            <span className='w-12 tabular-nums text-muted-foreground'>
              {Math.round((draw.brushSize * EXPORT_WIDTH * studio.design.ratio[0]) / studio.design.ratio[1])} px
            </span>
          </label>
        </>
      )}
    </div>
  );
}
