'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Eye, EyeSlash, Lock, Search, Unlock, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { StudioDesign, StudioLayer } from '@/lib/studio-design';
import { luminance, PALETTES } from './colors';
import { FlagArt } from './FlagArt';
import { layerImage } from './cutout';
import { useRecolored } from './images';
import { defaultParams, LAYOUT_PRESETS, LAYOUTS, type LayoutPreset } from './layouts';
import { documentColors, type StudioEmblem } from './model';
import { EMBLEM_MIME } from './StudioCanvas';
import { ColorPicker, Slider, Swatch } from './ui';
import { FIELD, type Studio } from './use-studio';

export const PanelTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className='text-[15px] font-semibold tracking-[-0.01em]'>{children}</h2>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className='mb-2 text-[12px] font-medium text-muted-foreground'>{children}</h3>
);

// ───────────────────────── Emblems ─────────────────────────

const COLLECTIONS: [string, string][] = [
  ['all', 'All'],
  ['country', 'Countries'],
  ['us', 'US'],
  ['canada', 'Canada'],
  ['europe-regions', 'Europe'],
  ['british-isles', 'British Isles'],
  ['historical', 'Historical'],
  ['japan', 'Japan'],
  ['other', 'More'],
];
const MAIN = new Set(COLLECTIONS.map(([key]) => key));

/** Dark emblems sit on a light tile and light ones on a dark tile, so every shape reads. */
function tileTone(colors: string[]) {
  if (colors.length === 0) return '';
  const l = colors.reduce((sum, c) => sum + luminance(c), 0) / colors.length;
  if (l < 0.08) return 'bg-[#e9e8e4] dark:bg-[#8d8e92]';
  if (l > 0.7) return 'bg-[#2a2b2f]';
  return 'bg-stage';
}

export function EmblemsPanel({
  emblems,
  onAdd,
  columns = 3,
}: {
  emblems: StudioEmblem[];
  onAdd: (emblem: StudioEmblem) => void;
  columns?: number;
}) {
  const [query, setQuery] = React.useState('');
  const [collection, setCollection] = React.useState('all');
  const q = query.trim().toLowerCase();
  const shown = emblems.filter(
    (e) =>
      (collection === 'all' || e.collection === collection || (collection === 'other' && !MAIN.has(e.collection))) &&
      (!q || e.names.some((name) => name.toLowerCase().includes(q))),
  );

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <label className='vx-well flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-ring'>
        <Search className='size-4 shrink-0' />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${emblems.length} emblems`}
          className='min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground'
        />
        {query && (
          <button type='button' aria-label='Clear' onClick={() => setQuery('')} className='cursor-pointer hover:text-foreground'>
            <X className='size-3.5' />
          </button>
        )}
      </label>
      <div className='-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]'>
        {COLLECTIONS.map(([key, label]) => (
          <button
            key={key}
            type='button'
            onClick={() => setCollection(key)}
            className={cn(
              'h-7 shrink-0 cursor-pointer rounded-full px-3 text-[12.5px] shadow-[inset_0_0_0_1px_var(--border)] transition-colors',
              collection === key ? 'bg-foreground text-background shadow-none' : 'text-subtle hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className='-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2'>
        <div className='grid gap-2' style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {shown.map((emblem) => (
            <button
              key={emblem.id}
              type='button'
              title={emblem.name.replace(/^the /, '')}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(EMBLEM_MIME, emblem.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => onAdd(emblem)}
              className={cn(
                'group relative aspect-square min-w-0 cursor-pointer rounded-[12px] outline-none transition-shadow hover:shadow-[inset_0_0_0_2px_var(--main)] focus-visible:shadow-[inset_0_0_0_2px_var(--main)] active:scale-[0.97]',
                tileTone(emblem.colors),
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- CDN cutouts */}
              <img src={emblem.src} alt='' loading='lazy' draggable={false} className='absolute inset-0 m-auto max-h-[64%] max-w-[64%] object-contain transition-transform group-hover:scale-105' />
            </button>
          ))}
        </div>
        {shown.length === 0 && <p className='py-10 text-center text-[13px] text-muted-foreground'>No emblems found</p>}
      </div>
    </div>
  );
}

// ───────────────────────── Layout ─────────────────────────

function presetDesign(design: StudioDesign, preset: LayoutPreset): StudioDesign {
  const def = LAYOUTS[preset.layout];
  return {
    ...design,
    layers: [],
    field: {
      kind: 'layout',
      layout: preset.layout,
      colors: def.colors.map((fallback, i) => design.field.colors[i] ?? fallback),
      params: defaultParams(preset.layout, preset.params),
    },
  };
}

const samePreset = (design: StudioDesign, preset: LayoutPreset) =>
  design.field.kind === 'layout' &&
  design.field.layout === preset.layout &&
  Object.entries(defaultParams(preset.layout, preset.params)).every(
    ([key, value]) => Math.abs((design.field.kind === 'layout' ? design.field.params[key] : NaN) - value) < 0.005,
  );

export function LayoutPanel({ studio, columns = 3 }: { studio: Studio; columns?: number }) {
  const { design, actions, history } = studio;
  const field = design.field;
  const params = field.kind === 'layout' ? LAYOUTS[field.layout].params : [];
  return (
    // Room around the tiles so the selected ring and hover zoom aren't clipped by the scroll area.
    <div className='-mx-1.5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1.5'>
      <div className='grid gap-2.5 pt-1.5' style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {LAYOUT_PRESETS.map((preset, i) => {
          const active = samePreset(design, preset);
          return (
            <button
              key={i}
              type='button'
              onClick={() => actions.setLayout(preset)}
              className={cn(
                'cursor-pointer rounded-[6px] outline-none transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring',
                active && 'ring-2 ring-main ring-offset-2 ring-offset-surface',
              )}
            >
              <FlagArt design={presetDesign({ ...design, ratio: [2, 3] }, preset)} className='block aspect-[3/2] w-full rounded-[4px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)]' />
            </button>
          );
        })}
      </div>
      {field.kind === 'layout' && params.length > 0 && (
        <div className='flex flex-col gap-3 border-t border-line pt-4'>
          {params.map((param) => (
            <label key={param.key} className='flex flex-col gap-1'>
              <span className='text-[12.5px] text-subtle'>{param.label}</span>
              <Slider
                label={param.label}
                min={param.min}
                max={param.max}
                step={param.step}
                value={field.params[param.key] ?? param.value}
                onChange={(value) => actions.setParam(param.key, value, { transient: true })}
                onCommit={history.commit}
              />
            </label>
          ))}
        </div>
      )}
      {field.kind === 'image' && (
        <p className='border-t border-line pt-4 text-[13px] text-subtle'>Pick a layout to rebuild this flag from parts.</p>
      )}
    </div>
  );
}

// ───────────────────────── Colours ─────────────────────────

/** A swatch that recolours every use of its colour across the flag. */
function GlobalSwatch({ studio, color }: { studio: Studio; color: string }) {
  const current = React.useRef(color);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) current.current = color;
  }, [color, open]);
  return (
    <Popover open={open} onOpenChange={(next) => (setOpen(next), !next && studio.history.commit())}>
      <PopoverTrigger asChild>
        <Swatch color={color} size={34} aria-label={color} active={open} />
      </PopoverTrigger>
      <PopoverContent side='right' align='start' className='w-auto p-3'>
        <ColorPicker
          value={color}
          documentColors={[]}
          onChange={(next) => {
            studio.actions.replaceColor(current.current, next, { transient: true });
            current.current = next;
          }}
          onCommit={studio.history.commit}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ColoursPanel({ studio }: { studio: Studio }) {
  const colors = documentColors(studio.design);
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto'>
      <div>
        <SectionLabel>This flag</SectionLabel>
        <div className='flex flex-wrap gap-2'>
          {colors.map((color, i) => (
            // Keyed by position so recolouring doesn't remount the open picker.
            <GlobalSwatch key={i} studio={studio} color={color} />
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>Palettes</SectionLabel>
        <div className='flex flex-col gap-1'>
          {PALETTES.map((palette) => (
            <button
              key={palette.name}
              type='button'
              onClick={() => studio.actions.applyPalette(palette.colors)}
              className='flex cursor-pointer items-center gap-3 rounded-[10px] p-1.5 text-left text-[13px] outline-none hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring'
            >
              <span className='flex h-6 w-24 shrink-0 overflow-hidden rounded-[6px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]'>
                {palette.colors.map((c) => (
                  <span key={c} className='flex-1' style={{ background: c }} />
                ))}
              </span>
              <span className='text-subtle'>{palette.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Layers ─────────────────────────

function LayerThumb({ layer }: { layer: StudioLayer }) {
  const url = useRecolored(layerImage(layer), layer.palette, layer.colors);
  return (
    <span className={cn('grid size-8 shrink-0 place-items-center rounded-[7px]', tileTone(layer.colors))}>
      {/* eslint-disable-next-line @next/next/no-img-element -- recoloured blob */}
      <img src={url} alt='' className='max-h-[78%] max-w-[78%] object-contain' style={{ transform: `scaleX(${layer.flipX ? -1 : 1})` }} />
    </span>
  );
}

function LayerName({ layer, onRename }: { layer: StudioLayer; onRename: (name: string) => void }) {
  const [editing, setEditing] = React.useState(false);
  if (editing)
    return (
      <input
        autoFocus
        defaultValue={layer.name}
        onBlur={(e) => (onRename(e.target.value), setEditing(false))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        className='vx-well h-7 min-w-0 flex-1 rounded-[7px] px-2 text-[13px] outline-none'
      />
    );
  return (
    <span className='min-w-0 flex-1 truncate' onDoubleClick={() => setEditing(true)}>
      {layer.name}
    </span>
  );
}

export function LayersPanel({ studio }: { studio: Studio }) {
  const { design, selection, setSelection, actions } = studio;
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [dropAt, setDropAt] = React.useState<number | null>(null);
  const ordered = [...design.layers].reverse();
  const fieldDesign: StudioDesign = { ...design, layers: [] };

  const select = (id: string, additive: boolean) =>
    setSelection(additive ? (selection.includes(id) ? selection.filter((s) => s !== id) : [...selection.filter((s) => s !== FIELD), id]) : [id]);

  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
      <div className='flex flex-col gap-0.5'>
        {ordered.map((layer, row) => {
          const active = selection.includes(layer.id);
          return (
            <div
              key={layer.id}
              draggable
              onDragStart={(e) => {
                setDragging(layer.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', layer.id);
              }}
              onDragEnd={() => (setDragging(null), setDropAt(null))}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                setDropAt(e.clientY < r.top + r.height / 2 ? row : row + 1);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging && dropAt !== null) {
                  // Rows run top-down; layers bottom-up.
                  const from = ordered.findIndex((l) => l.id === dragging);
                  const target = dropAt > from ? dropAt - 1 : dropAt;
                  actions.move(dragging, design.layers.length - 1 - target);
                }
                setDragging(null);
                setDropAt(null);
              }}
              onClick={(e) => select(layer.id, e.shiftKey || e.metaKey)}
              className={cn(
                'group relative flex h-11 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-[13px] transition-colors',
                active ? 'bg-main-soft text-foreground' : 'text-subtle hover:bg-foreground/[0.05] hover:text-foreground',
                layer.hidden && 'opacity-50',
                dragging === layer.id && 'opacity-40',
              )}
            >
              {dropAt === row && <span className='absolute inset-x-2 -top-px h-0.5 rounded bg-main' />}
              {dropAt === row + 1 && row === ordered.length - 1 && <span className='absolute inset-x-2 -bottom-px h-0.5 rounded bg-main' />}
              <LayerThumb layer={layer} />
              <LayerName layer={layer} onRename={(name) => actions.rename(layer.id, name)} />
              <button
                type='button'
                aria-label={layer.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => (e.stopPropagation(), actions.toggleLocked(layer.id))}
                className={cn('grid size-7 cursor-pointer place-items-center rounded-[7px] hover:bg-foreground/[0.07]', !layer.locked && 'opacity-0 group-hover:opacity-70')}
              >
                {layer.locked ? <Lock className='size-3.5' /> : <Unlock className='size-3.5' />}
              </button>
              <button
                type='button'
                aria-label={layer.hidden ? 'Show' : 'Hide'}
                onClick={(e) => (e.stopPropagation(), actions.toggleHidden(layer.id))}
                className={cn('grid size-7 cursor-pointer place-items-center rounded-[7px] hover:bg-foreground/[0.07]', !layer.hidden && 'opacity-0 group-hover:opacity-70')}
              >
                {layer.hidden ? <EyeSlash className='size-3.5' /> : <Eye className='size-3.5' />}
              </button>
            </div>
          );
        })}
        <div
          onClick={() => setSelection([FIELD])}
          className={cn(
            'flex h-11 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-[13px] transition-colors',
            selection.includes(FIELD) ? 'bg-main-soft text-foreground' : 'text-subtle hover:bg-foreground/[0.05] hover:text-foreground',
          )}
        >
          <FlagArt design={fieldDesign} className='h-5 w-8 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.15)]' />
          <span className='flex-1'>Field</span>
        </div>
      </div>
    </div>
  );
}
