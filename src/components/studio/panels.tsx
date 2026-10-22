'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Copy, Dice, Eye, EyeSlash, Lock, Minus, Plus, Search, Trash2, Unlock, Upload, X } from '@/components/icons';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { EMBLEM_CATEGORIES, emblemSearchScore, mixEmblemCategories } from '@/lib/emblem-search';
import type { EdgeStyle, StudioDesign, StudioDivision, StudioField, StudioLayer } from '@/lib/studio-design';
import { luminance, PALETTE_GROUPS, PALETTES } from './colors';
import { FlagArt } from './FlagArt';
import { layerImage } from './cutout';
import { DIVISION_KINDS, DIVISIONS, divisionParams, divisionParts } from './divisions';
import { divisionFor, LAYOUT_TEMPLATES, PART_TEMPLATES, sameShape, templateField, type FieldTemplate, type StackField } from './field';
import { useRecolored } from './images';
import { documentColors, layerColors, layerWidth, type StudioEmblem } from './model';
import { shapePath } from './shapes';
import { EMBLEM_MIME } from './StudioCanvas';
import { ColorButton } from './tools';
import { ColorPicker, Slider, Swatch } from './ui';
import { FIELD, type Studio } from './use-studio';

export const PanelTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className='text-[15px] font-semibold tracking-[-0.01em]'>{children}</h2>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className='mb-2 text-[12px] font-medium text-muted-foreground'>{children}</h3>
);

// ───────────────────────── Emblems ─────────────────────────

const CATEGORIES = [['all', 'All'], ...EMBLEM_CATEGORIES] as const;
const EMBLEMS_PER_PAGE = 120;

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
  onUpload,
  columns = 3,
}: {
  emblems: StudioEmblem[];
  onAdd: (emblem: StudioEmblem) => void;
  onUpload?: (files: File[]) => void;
  columns?: number;
}) {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [visible, setVisible] = React.useState(EMBLEMS_PER_PAGE);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const moreRef = React.useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const matches = React.useMemo(() => {
    const ranked = emblems
      .filter((e) => category === 'all' || e.category === category)
      .map((e) => ({ emblem: e, score: emblemSearchScore(e, q) }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score || (b.emblem.rank ?? 0) - (a.emblem.rank ?? 0) || b.emblem.copies - a.emblem.copies)
      .map((e) => e.emblem);
    return category === 'all' && !q ? mixEmblemCategories(ranked) : ranked;
  }, [emblems, category, q]);
  const shown = matches.slice(0, visible);
  const hasMore = matches.length > shown.length;

  React.useEffect(() => {
    const root = scrollRef.current;
    const sentinel = moreRef.current;
    if (!hasMore || !root || !sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible((n) => Math.min(n + EMBLEMS_PER_PAGE, matches.length));
    }, { root, rootMargin: '0px 0px 600px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, matches.length, visible]);

  const resetResults = () => {
    setVisible(EMBLEMS_PER_PAGE);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <label className='vx-well flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-ring'>
        <Search className='size-4 shrink-0' />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); resetResults(); }}
          placeholder={`Search ${emblems.length} emblems`}
          className='min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground'
        />
        {query && (
          <button type='button' aria-label='Clear' onClick={() => { setQuery(''); resetResults(); }} className='cursor-pointer hover:text-foreground'>
            <X className='size-3.5' />
          </button>
        )}
      </label>
      <div className='-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]'>
        {CATEGORIES.map(([key, label]) => (
          <button
            key={key}
            type='button'
            onClick={() => { setCategory(key); resetResults(); }}
            aria-pressed={category === key}
            className={cn(
              'h-7 shrink-0 cursor-pointer rounded-full px-3 text-[12.5px] shadow-[inset_0_0_0_1px_var(--border)] transition-colors',
              category === key ? 'bg-foreground text-background shadow-none' : 'text-subtle hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div ref={scrollRef} className='-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2'>
        <div className='grid gap-2' style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {onUpload && !q && category === 'all' && (
            <label
              title='Your own image'
              className='grid aspect-square min-w-0 cursor-pointer place-items-center rounded-[12px] text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--border)] transition-colors focus-within:ring-2 focus-within:ring-ring hover:text-foreground hover:shadow-[inset_0_0_0_2px_var(--main)] [&_svg]:size-6'
            >
              <Upload />
              <input
                type='file'
                accept='image/png,image/jpeg,image/webp,image/svg+xml'
                multiple
                className='sr-only'
                onChange={(e) => {
                  onUpload([...(e.target.files ?? [])]);
                  e.target.value = '';
                }}
              />
            </label>
          )}
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
        {hasMore && <div ref={moreRef} className='h-px' aria-hidden='true' />}
        <span role='status' className='sr-only'>{shown.length} of {matches.length} emblems</span>
        {matches.length === 0 && <p className='py-10 text-center text-[13px] text-muted-foreground'>No emblems found</p>}
      </div>
    </div>
  );
}

// ───────────────────────── Field ─────────────────────────

const THUMB = 'block aspect-[3/2] w-full rounded-[4px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)]';

/** The field alone, for thumbnails. */
const fieldOnly = (design: StudioDesign, field: StudioField, ratio = design.ratio): StudioDesign => ({ ...design, ratio, field, layers: [] });

/** One division across the whole flag, on the base colour unless that would hide it. */
function divisionThumb(design: StudioDesign, field: StackField, division: StudioDivision, ratio = design.ratio) {
  const own = [...division.colors, division.fimbriation?.color].filter(Boolean).map((c) => c!.toUpperCase());
  const color = !own.includes(field.color.toUpperCase()) ? field.color : luminance(own[0]) > 0.5 ? '#6B7280' : '#D1D5DB';
  return fieldOnly(design, { ...field, color, divisions: [{ ...division, box: undefined, hidden: false }] }, ratio);
}

const EDGE_OPTIONS: { value: EdgeStyle | 'none'; label: string }[] = [
  { value: 'none', label: 'Straight' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'serrated', label: 'Serrated' },
  { value: 'stepped', label: 'Stepped' },
];

/** The field, built from divisions stacked over a base colour; or a template to start from. */
export function LayoutPanel({ studio, columns = 3 }: { studio: Studio; columns?: number }) {
  const field = studio.design.field;
  const [tab, setTab] = React.useState<'parts' | 'templates'>(field.kind === 'stack' ? 'parts' : 'templates');
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <Segmented
        aria-label='Field'
        value={field.kind === 'stack' ? tab : 'templates'}
        options={[
          { value: 'parts', label: 'Parts' },
          { value: 'templates', label: 'Templates' },
        ]}
        onChange={setTab}
        className='w-full [&>button]:flex-1 [&>button]:justify-center'
      />
      {/* Room around the tiles so the selected ring and hover zoom aren't clipped by the scroll area. */}
      <div className='-mx-1.5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1.5 pb-2'>
        {field.kind === 'stack' && tab === 'parts' ? (
          <DivisionsEditor studio={studio} field={field} columns={columns} />
        ) : (
          <Templates studio={studio} columns={columns} onPicked={() => setTab('parts')} />
        )}
      </div>
    </div>
  );
}

function Templates({ studio, columns, onPicked }: { studio: Studio; columns: number; onPicked: () => void }) {
  const { design, actions } = studio;
  // Previews in the flag's colours; ids only need to be distinct within one preview.
  const previews = React.useMemo(() => {
    let n = 0;
    return new Map([...LAYOUT_TEMPLATES, ...PART_TEMPLATES].map((t) => [t.id, templateField(t, design.field, () => `t${n++}`)]));
  }, [design.field]);
  const grid = (templates: FieldTemplate[]) => (
    <div className='grid gap-2.5' style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {templates.map((template) => {
        const field = previews.get(template.id)!;
        const active = sameShape(design.field, field);
        return (
          <button
            key={template.id}
            type='button'
            title={template.label}
            aria-label={template.label}
            onClick={() => (actions.applyTemplate(template), onPicked())}
            className={cn(
              'cursor-pointer rounded-[6px] outline-none transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring',
              active && 'ring-2 ring-main ring-offset-2 ring-offset-surface',
            )}
          >
            <FlagArt design={fieldOnly(design, field, [2, 3])} className={THUMB} />
          </button>
        );
      })}
    </div>
  );
  return (
    <>
      <div className='pt-1.5'>
        <SectionLabel>Layouts</SectionLabel>
        {grid(LAYOUT_TEMPLATES)}
      </div>
      <div>
        <SectionLabel>Built from parts</SectionLabel>
        {grid(PART_TEMPLATES)}
      </div>
      {design.field.kind === 'image' && <p className='text-[13px] text-subtle'>Pick a template to rebuild this flag from parts.</p>}
    </>
  );
}

const divisionLabel = (division: StudioDivision) => division.name ?? DIVISIONS[division.kind].label;

/**
 * Drag-to-reorder for a list shown top-down over items stored bottom-up (layers, divisions).
 * `onMove` gets the dragged id and its new index in storage order.
 */
function useReorder(ids: string[], onMove: (id: string, index: number) => void) {
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [dropAt, setDropAt] = React.useState<number | null>(null);
  const end = () => (setDragging(null), setDropAt(null));
  const rowProps = (id: string, row: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragging(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },
    onDragEnd: end,
    onDragOver: (e: React.DragEvent<HTMLElement>) => {
      if (!dragging) return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      setDropAt(e.clientY < r.top + r.height / 2 ? row : row + 1);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragging && dropAt !== null) {
        const from = ids.indexOf(dragging);
        const target = dropAt > from ? dropAt - 1 : dropAt;
        if (target !== from) onMove(dragging, ids.length - 1 - target);
      }
      end();
    },
  });
  /** The line showing where a drop would land, for a row. */
  const marker = (row: number) => (
    <>
      {dropAt === row && <span className='absolute inset-x-2 -top-px h-0.5 rounded bg-main' />}
      {dropAt === row + 1 && row === ids.length - 1 && <span className='absolute inset-x-2 -bottom-px h-0.5 rounded bg-main' />}
    </>
  );
  return { dragging, rowProps, marker };
}

function DivisionsEditor({ studio, field, columns }: { studio: Studio; field: StackField; columns: number }) {
  const { design, selectedDivision, actions } = studio;
  const rows = [...field.divisions].reverse();
  const reorder = useReorder(
    rows.map((d) => d.id),
    actions.moveDivision,
  );
  const baseSelected = !selectedDivision;
  return (
    <>
      <div className='flex flex-col gap-0.5 pt-1'>
        <div className='mb-1 flex items-center justify-between'>
          <SectionLabel>Divisions</SectionLabel>
          <AddDivision studio={studio} field={field} columns={columns} />
        </div>
        {rows.map((division, row) => {
          const active = selectedDivision?.id === division.id;
          return (
            <div
              key={division.id}
              {...reorder.rowProps(division.id, row)}
              onClick={() => actions.selectDivision(division.id)}
              className={cn(
                'group relative flex h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-[13px] transition-colors',
                active ? 'bg-main-soft text-foreground' : 'text-subtle hover:bg-foreground/[0.05] hover:text-foreground',
                division.hidden && 'opacity-50',
                reorder.dragging === division.id && 'opacity-40',
              )}
            >
              {reorder.marker(row)}
              <FlagArt
                design={divisionThumb(design, field, division)}
                className='h-5 w-8 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.15)]'
              />
              <span className='min-w-0 flex-1 truncate'>{divisionLabel(division)}</span>
              <RowButton label={division.locked ? 'Unlock' : 'Lock'} pinned={division.locked} onClick={() => actions.toggleDivisionLocked(division.id)}>
                {division.locked ? <Lock className='size-3.5' /> : <Unlock className='size-3.5' />}
              </RowButton>
              <RowButton label={division.hidden ? 'Show' : 'Hide'} pinned={division.hidden} onClick={() => actions.toggleDivisionHidden(division.id)}>
                {division.hidden ? <EyeSlash className='size-3.5' /> : <Eye className='size-3.5' />}
              </RowButton>
            </div>
          );
        })}
        <div
          onClick={() => actions.selectDivision(null)}
          className={cn(
            'flex h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-[13px] transition-colors',
            baseSelected ? 'bg-main-soft text-foreground' : 'text-subtle hover:bg-foreground/[0.05] hover:text-foreground',
          )}
        >
          <span className='h-5 w-8 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.15)]' style={{ background: field.color }} />
          <span className='flex-1'>Base</span>
        </div>
      </div>
      <div className='flex flex-col gap-3.5 border-t border-line pt-4'>
        {selectedDivision ? (
          <DivisionSettings key={selectedDivision.id} studio={studio} division={selectedDivision} />
        ) : (
          <Setting label='Base colour'>
            <div className='flex'>
              <ColorButton color={field.color} studio={studio} side='right' size={26} label='Base colour' onChange={(color, transient) => actions.setBaseColor(color, { transient })} />
            </div>
          </Setting>
        )}
      </div>
    </>
  );
}

function RowButton({
  label,
  pinned,
  onClick,
  children,
}: {
  label: string;
  pinned?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      onClick={(e) => (e.stopPropagation(), onClick())}
      className={cn(
        'grid size-6 shrink-0 cursor-pointer place-items-center rounded-[6px] hover:bg-foreground/[0.07]',
        !pinned && 'opacity-0 focus-visible:opacity-70 group-hover:opacity-70',
      )}
    >
      {children}
    </button>
  );
}

function AddDivision({ studio, field, columns }: { studio: Studio; field: StackField; columns: number }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='-mt-2 inline-flex h-7 cursor-pointer items-center gap-1 rounded-[8px] px-2 text-[12.5px] font-medium text-subtle hover:bg-foreground/[0.06] hover:text-foreground'
        >
          <Plus className='size-3.5' />
          Add
        </button>
      </PopoverTrigger>
      <PopoverContent side='right' align='start' className='max-h-[var(--radix-popover-content-available-height)] w-[300px] overflow-y-auto p-3'>
        <div className='grid gap-2' style={{ gridTemplateColumns: `repeat(${Math.min(columns, 3)}, minmax(0, 1fr))` }}>
          {DIVISION_KINDS.map((kind) => (
            <button
              key={kind}
              type='button'
              onClick={() => (studio.actions.addDivision(kind), setOpen(false))}
              className='flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-[8px] p-1 text-[11.5px] text-subtle outline-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
            >
              <FlagArt design={divisionThumb(studio.design, field, divisionFor(field, kind, kind), [2, 3])} className={THUMB} />
              <span className='w-full truncate text-center'>{DIVISIONS[kind].label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const Setting = ({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) => (
  <div className='flex flex-col gap-1.5'>
    <span className='flex justify-between text-[12.5px] text-subtle'>
      {label}
      {value !== undefined && <span className='tabular-nums text-muted-foreground'>{value}</span>}
    </span>
    {children}
  </div>
);

function DivisionSettings({ studio, division }: { studio: Studio; division: StudioDivision }) {
  const { actions, history } = studio;
  const def = DIVISIONS[division.kind];
  const params = divisionParams(division);
  const id = division.id;
  const parts = divisionParts(division);
  const shown = def.cycles ? division.colors.slice(0, parts) : division.colors.slice(0, 1);
  const weighted = def.weighted?.(params) ?? 0;
  const fim = division.fimbriation ?? null;
  const edge = division.edge ?? null;
  const box = division.box ?? null;
  const commit = history.commit;
  const transient = { transient: true };
  return (
    <>
      <div className='flex items-center gap-2'>
        <span className='flex-1 truncate text-[13.5px] font-medium'>{divisionLabel(division)}</span>
        <RowButton label='Duplicate' pinned onClick={() => actions.duplicateDivision(id)}>
          <Copy className='size-3.5' />
        </RowButton>
        <RowButton label='Delete' pinned onClick={() => actions.removeDivision(id)}>
          <Trash2 className='size-3.5' />
        </RowButton>
      </div>

      <Setting label={shown.length > 1 ? 'Colours' : 'Colour'}>
        <div className='flex flex-wrap items-center gap-1.5'>
          {shown.map((color, i) => (
            <ColorButton key={i} color={color} studio={studio} side='right' size={26} label={`Colour ${i + 1}`} onChange={(next, t) => actions.setDivisionColor(id, i, next, { transient: t })} />
          ))}
          {def.cycles && (
            <>
              {division.colors.length < Math.min(16, parts) && (
                <RowButton label='Add colour' pinned onClick={() => actions.updateDivision(id, { colors: [...division.colors, division.colors[division.colors.length % 2]] })}>
                  <Plus className='size-3.5' />
                </RowButton>
              )}
              {division.colors.length > 1 && (
                <RowButton label='Remove colour' pinned onClick={() => actions.updateDivision(id, { colors: division.colors.slice(0, Math.min(division.colors.length, parts) - 1) })}>
                  <Minus className='size-3.5' />
                </RowButton>
              )}
            </>
          )}
        </div>
      </Setting>

      {def.params.map((param) =>
        param.options ? (
          <Setting key={param.key} label={param.label}>
            <Segmented
              aria-label={param.label}
              value={String(Math.round(params[param.key]))}
              options={param.options.map((o) => ({ value: String(o.value), label: o.label }))}
              onChange={(value) => actions.setDivisionParam(id, param.key, Number(value))}
              className='flex-wrap [&>button]:h-[26px] [&>button]:px-2 [&>button]:text-[12px]'
            />
          </Setting>
        ) : (
          <Setting key={param.key} label={param.label} value={formatParam(params[param.key], param.step)}>
            <Slider
              label={param.label}
              min={param.min}
              max={param.max}
              step={param.step}
              value={params[param.key]}
              onChange={(value) => actions.setDivisionParam(id, param.key, value, transient)}
              onCommit={commit}
            />
          </Setting>
        ),
      )}

      {weighted > 1 && (
        <Setting label='Sizes'>
          <div className='flex flex-col gap-1.5'>
            {Array.from({ length: weighted }, (_, i) => (
              <Slider
                key={i}
                label={`Size ${i + 1}`}
                min={0.1}
                max={5}
                step={0.05}
                value={params[`w${i}`] ?? 1}
                onChange={(value) => actions.setDivisionParam(id, `w${i}`, value, transient)}
                onCommit={commit}
              />
            ))}
          </div>
        </Setting>
      )}

      <div className='flex flex-col gap-3 border-t border-line pt-3.5'>
        <label className='flex items-center justify-between text-[12.5px] text-subtle'>
          Fimbriation
          <Switch
            checked={Boolean(fim)}
            onCheckedChange={(on) => actions.updateDivision(id, { fimbriation: on ? { color: '#FFFFFF', width: 0.03 } : null })}
          />
        </label>
        {fim && (
          <div className='flex items-center gap-2.5'>
            <ColorButton
              color={fim.color}
              studio={studio}
              side='right'
              size={26}
              label='Fimbriation colour'
              onChange={(color, t) => actions.updateDivision(id, { fimbriation: { ...fim, color } }, { transient: t })}
            />
            <Slider
              label='Fimbriation width'
              min={0.005}
              max={0.2}
              step={0.005}
              value={fim.width}
              onChange={(width) => actions.updateDivision(id, { fimbriation: { ...fim, width } }, transient)}
              onCommit={commit}
            />
          </div>
        )}
      </div>

      <div className='flex flex-col gap-3 border-t border-line pt-3.5'>
        <Setting label='Edges'>
          <Segmented
            aria-label='Edges'
            value={edge?.style ?? 'none'}
            options={EDGE_OPTIONS}
            onChange={(style) =>
              actions.updateDivision(id, { edge: style === 'none' ? null : { depth: edge?.depth ?? 0.04, period: edge?.period ?? 0.2, style } })
            }
            className='flex-wrap [&>button]:h-[26px] [&>button]:px-2 [&>button]:text-[12px]'
          />
        </Setting>
        {edge && (
          <>
            <Setting label='Depth' value={formatParam(edge.depth, 0.005)}>
              <Slider label='Edge depth' min={0.005} max={0.2} step={0.005} value={edge.depth} onChange={(depth) => actions.updateDivision(id, { edge: { ...edge, depth } }, transient)} onCommit={commit} />
            </Setting>
            <Setting label='Length' value={formatParam(edge.period, 0.01)}>
              <Slider label='Edge length' min={0.03} max={1} step={0.01} value={edge.period} onChange={(period) => actions.updateDivision(id, { edge: { ...edge, period } }, transient)} onCommit={commit} />
            </Setting>
          </>
        )}
      </div>

      <div className='flex flex-col gap-3 border-t border-line pt-3.5'>
        <label className='flex items-center justify-between text-[12.5px] text-subtle'>
          Only in part of the flag
          <Switch checked={Boolean(box)} onCheckedChange={(on) => actions.updateDivision(id, { box: on ? [0, 0, 0.5, 0.5] : undefined })} />
        </label>
        {box &&
          (['Left', 'Top', 'Right', 'Bottom'] as const).map((label, i) => (
            <Setting key={label} label={label} value={formatParam(box[i], 0.01)}>
              <Slider
                label={`Box ${label.toLowerCase()}`}
                min={0}
                max={1}
                step={0.01}
                value={box[i]}
                onChange={(value) => {
                  const next = [...box] as [number, number, number, number];
                  next[i] = value;
                  // Keep at least a sliver between opposite edges.
                  if (i < 2) next[i] = Math.min(value, next[i + 2] - 0.02);
                  else next[i] = Math.max(value, next[i - 2] + 0.02);
                  actions.updateDivision(id, { box: next }, transient);
                }}
                onCommit={commit}
              />
            </Setting>
          ))}
      </div>
    </>
  );
}

const formatParam = (value: number, step: number) => (step >= 1 ? String(Math.round(value)) : value.toFixed(step >= 0.01 ? 2 : 3));

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
      <button
        type='button'
        onClick={() => studio.actions.applyPalette(PALETTES[Math.floor(Math.random() * PALETTES.length)].colors)}
        className='flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] text-[13px] font-medium text-subtle shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:bg-foreground/[0.05] hover:text-foreground [&_svg]:size-4'
      >
        <Dice />
        Surprise me
      </button>
      {PALETTE_GROUPS.map((group) => (
        <div key={group.name}>
          <SectionLabel>{group.name}</SectionLabel>
          <div className='flex flex-col gap-0.5'>
            {group.palettes.map((palette) => (
              <button
                key={palette.name}
                type='button'
                onClick={() => studio.actions.applyPalette(palette.colors)}
                className='flex cursor-pointer items-center gap-3 rounded-[10px] p-1.5 text-left text-[13px] outline-none hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring'
              >
                {/* The edge sits over the colours, so white and pale ones still read against the panel. */}
                <span className='relative flex h-6 w-24 shrink-0 overflow-hidden rounded-[6px] after:absolute after:inset-0 after:rounded-[6px] after:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)]'>
                  {palette.colors.map((c, i) => (
                    <span key={i} className='flex-1' style={{ background: c }} />
                  ))}
                </span>
                <span className='min-w-0 truncate text-subtle'>{palette.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Layers ─────────────────────────

function ShapeThumb({ layer }: { layer: StudioLayer }) {
  const shape = layer.shape!;
  const [w, h] = [layerWidth(layer), layer.size];
  const k = Math.max(w, h);
  // Thin strokes would vanish at this size.
  const stroke = shape.stroke > 0 ? Math.max(shape.stroke, k * (shape.kind === 'brush' ? 0.1 : 0.05)) : 0;
  const drawn = { ...shape, stroke };
  return (
    <span className={cn('relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[7px]', tileTone(layerColors(layer)))}>
      <svg viewBox={`${-k / 2} ${-k / 2} ${k} ${k}`} className='size-[72%]' style={{ transform: `rotate(${layer.rotation}deg)` }}>
        <path
          d={shapePath(drawn, w, h)}
          fill={shape.fill ? layer.colors[0] : 'none'}
          fillRule='evenodd'
          stroke={stroke ? (layer.colors[1] ?? layer.colors[0]) : 'none'}
          strokeWidth={stroke}
          strokeLinecap='round'
          strokeLinejoin='round'
          transform={`scale(${layer.flipX ? -1 : 1} ${layer.flipY ? -1 : 1})`}
        />
      </svg>
    </span>
  );
}

function LayerThumb({ layer }: { layer: StudioLayer }) {
  if (layer.shape) return <ShapeThumb layer={layer} />;
  return <ImageThumb layer={layer} />;
}

function ImageThumb({ layer }: { layer: StudioLayer }) {
  const url = useRecolored(layerImage(layer), layer.palette, layer.colors);
  return (
    <span className={cn('relative size-8 shrink-0 overflow-hidden rounded-[7px]', tileTone(layer.colors))}>
      {/* eslint-disable-next-line @next/next/no-img-element -- recoloured blob */}
      <img src={url} alt='' className='absolute inset-[11%] size-[78%] object-contain' style={{ transform: `scaleX(${layer.flipX ? -1 : 1})` }} />
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
  const ordered = [...design.layers].reverse();
  const reorder = useReorder(
    ordered.map((l) => l.id),
    actions.move,
  );
  const fieldDesign: StudioDesign = { ...design, layers: [] };

  const select = (id: string, additive: boolean) =>
    setSelection(
      additive
        ? selection.includes(id)
          ? selection.filter((s) => s !== id)
          : [...selection.filter((s) => design.layers.some((l) => l.id === s)), id]
        : [id],
    );

  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
      <div className='flex flex-col gap-0.5'>
        {ordered.map((layer, row) => {
          const active = selection.includes(layer.id);
          return (
            <div
              key={layer.id}
              {...reorder.rowProps(layer.id, row)}
              onClick={(e) => select(layer.id, e.shiftKey || e.metaKey)}
              className={cn(
                'group relative flex h-11 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-[13px] transition-colors',
                active ? 'bg-main-soft text-foreground' : 'text-subtle hover:bg-foreground/[0.05] hover:text-foreground',
                layer.hidden && 'opacity-50',
                reorder.dragging === layer.id && 'opacity-40',
              )}
            >
              {reorder.marker(row)}
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
            studio.fieldSelected ? 'bg-main-soft text-foreground' : 'text-subtle hover:bg-foreground/[0.05] hover:text-foreground',
          )}
        >
          <FlagArt design={fieldDesign} className='h-5 w-8 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.15)]' />
          <span className='flex-1'>Field</span>
        </div>
      </div>
    </div>
  );
}
