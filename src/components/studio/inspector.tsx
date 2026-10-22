'use client';

import React from 'react';
import { Switch } from '@/components/ui/switch';
import {
  Copy,
  FlipHorizontal,
  FlipVertical,
  GroupIcon,
  MoreHorizontal,
  Proportions,
  RotateQuarter,
  SquaresFour,
  SwapColors,
  Trash2,
  Ungroup,
  WandSparkles,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { pixelSize } from './model';
import { evaluate, formatShare } from './numbers';
import { DivisionSettings } from './panels';
import {
  AlignControls,
  FieldSwatches,
  LayerMoreMenu,
  LayerSwatches,
  OpacitySlider,
  OutlineControls,
  PathControls,
  RepeatControls,
  SelectionSwatches,
  ShapeControls,
  ShapeSettingsFields,
  TextControls,
  TextSettings,
  canGroup,
  hasShapeSettings,
  selectionOpacity,
  selectionRepeat,
} from './tools';
import { selectionFrame } from './transform';
import { ToolButton } from './ui';
import type { Studio } from './use-studio';

/**
 * Everything about what's selected, in one panel that stays put: changing a setting never
 * moves it, and nothing it opens lands on the flag unless it has to.
 */
export function Inspector({ studio, onOpenLayout, className, style }: { studio: Studio; onOpenLayout: () => void; className?: string; style?: React.CSSProperties }) {
  const { selectedLayers, selectedDivision, pathEdit } = studio;
  let content: React.ReactNode;
  if (pathEdit) content = <PointsInspector studio={studio} />;
  else if (selectedLayers.length > 0) content = <LayersInspector studio={studio} />;
  else if (selectedDivision)
    content = (
      <div className='flex flex-col gap-3.5 p-4'>
        <DivisionSettings key={selectedDivision.id} studio={studio} division={selectedDivision} />
      </div>
    );
  else content = <FlagInspector studio={studio} onOpenLayout={onOpenLayout} />;
  return (
    <aside className={cn('vx-tile flex flex-col overflow-hidden shadow-pop', className)} style={style} aria-label='Inspector'>
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>{content}</div>
    </aside>
  );
}

function Section({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className='flex flex-col gap-2.5 border-t border-line px-4 py-3.5 first:border-t-0'>
      {(title || action) && (
        <div className='flex min-h-6 items-center justify-between gap-2'>
          {title && <h3 className='text-[12px] font-medium text-muted-foreground'>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Header({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className='flex items-center gap-1 border-b border-line py-2.5 pl-4 pr-2.5'>
      <span className='min-w-0 flex-1 truncate text-[14px] font-semibold'>{title}</span>
      {children}
    </div>
  );
}

function PointsInspector({ studio }: { studio: Studio }) {
  const { pathEdit, actions } = studio;
  if (!pathEdit) return null;
  const count = pathEdit.nodes.length;
  return (
    <>
      <Header title='Editing points'>
        <ToolButton label='Done (Enter)' onClick={actions.stopEditing} className='text-main hover:text-main'>
          <span>Done</span>
        </ToolButton>
      </Header>
      <Section title='Paint'>
        <div className='-mx-2 flex flex-wrap items-center gap-0.5'>
          <ShapeControls studio={studio} layers={[pathEdit.layer]} side='left' />
        </div>
      </Section>
      <Section title={count > 0 ? `${count} ${count === 1 ? 'point' : 'points'} selected` : 'Points'}>
        {count > 0 ? (
          <ToolButton label='Delete points' onClick={actions.deleteNodes} className='-ml-2 self-start'>
            <Trash2 />
            <span>Delete</span>
          </ToolButton>
        ) : (
          <p className='text-[12.5px] text-muted-foreground'>Drag points and handles on the flag. Click a point to pick it; double-click a line to add one.</p>
        )}
      </Section>
    </>
  );
}

function LayersInspector({ studio }: { studio: Studio }) {
  const { selectedLayers, selectedGroup, actions } = studio;
  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const title = selectedGroup ? selectedGroup.name : single ? single.name : `${selectedLayers.length} layers`;
  const repeat = selectionRepeat(studio);
  return (
    <>
      <Header title={title}>
        {selectedGroup ? (
          <ToolButton label='Ungroup (⇧⌘G)' side='bottom' onClick={actions.ungroup}>
            <Ungroup />
          </ToolButton>
        ) : (
          canGroup(studio) && (
            <ToolButton label='Group (⌘G)' side='bottom' onClick={actions.group}>
              <GroupIcon />
            </ToolButton>
          )
        )}
        <ToolButton label='Duplicate' side='bottom' onClick={() => actions.duplicateSelected()}>
          <Copy />
        </ToolButton>
        <ToolButton label='Delete' side='bottom' onClick={actions.deleteSelected}>
          <Trash2 />
        </ToolButton>
        <LayerMoreMenu studio={studio} side='bottom'>
          <ToolButton label='More' side='bottom'>
            <MoreHorizontal />
          </ToolButton>
        </LayerMoreMenu>
      </Header>
      <PositionSection studio={studio} />
      <AppearanceSections studio={studio} />
      <Section title='Opacity' action={<span className='text-[12px] tabular-nums text-muted-foreground'>{Math.round(selectionOpacity(studio) * 100)}%</span>}>
        <OpacitySlider studio={studio} />
      </Section>
      {repeat && (
        <Section title='Repeat'>
          <RepeatControls studio={studio} className='w-full' />
        </Section>
      )}
      <Section title='Align'>
        <AlignControls studio={studio} className='w-full' />
      </Section>
    </>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

type Units = 'px' | 'flag';
const UNITS_KEY = 'vexilo-studio-units';

/** Pixels, or shares of the flag, kept between visits. */
function useUnits() {
  const [units, setUnits] = React.useState<Units>(() => (typeof window !== 'undefined' && localStorage.getItem(UNITS_KEY) === 'flag' ? 'flag' : 'px'));
  return [units, (next: Units) => (setUnits(next), localStorage.setItem(UNITS_KEY, next))] as const;
}

/**
 * Where the selection sits and how big it is, typed in exactly: in export pixels, or as shares of
 * the flag, across for X and W and down for Y and H, so "1/3" puts it a third of the way along.
 */
function PositionSection({ studio }: { studio: Studio }) {
  const { design, W, actions, selectedGroup } = studio;
  const [linked, setLinked] = React.useState(true);
  const [units, setUnits] = useUnits();
  const layers = studio.selectedLayers.filter((l) => !l.locked && !l.hidden);
  const frame = selectionFrame(design, layers, W);
  if (!frame) return null;
  const px = pixelSize(W);
  // Flag units in one of each field's units, across and down.
  const [ux, uy] = units === 'px' ? [px, px] : [W, 1];
  const [x, y] = [(frame.cx - frame.w / 2) / ux, (frame.cy - frame.h / 2) / uy];
  const [w, h] = [frame.w / ux, frame.h / uy];
  // A lone layer's frame turns with it; anything more is boxed square to the flag.
  const turns = layers.length === 1 && !selectedGroup;
  const size = (next: { w?: number; h?: number }) => {
    if (!linked) return actions.setFrame({ w: next.w !== undefined ? next.w * ux : undefined, h: next.h !== undefined ? next.h * uy : undefined });
    const k = next.w !== undefined ? next.w / w : next.h! / h;
    actions.setFrame({ w: frame.w * k, h: frame.h * k });
  };
  const field = units === 'px' ? { format: (n: number) => String(round(n)), precision: 0.1, step: 1 } : { format: formatShare, precision: 1e-6, step: 0.01 };
  const across = { ...field, percent: W / ux, px: px / ux };
  const down = { ...field, percent: 1 / uy, px: px / uy };
  return (
    <Section
      title='Position'
      action={
        <div role='radiogroup' aria-label='Units' className='flex gap-0.5'>
          {(['px', 'flag'] as const).map((u) => (
            <button
              key={u}
              type='button'
              role='radio'
              aria-checked={units === u}
              title={u === 'px' ? 'Export pixels' : 'Shares of the flag: across for X and W, down for Y and H'}
              onClick={() => setUnits(u)}
              className={cn(
                'h-6 cursor-pointer rounded-[6px] px-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground',
                units === u && 'bg-foreground/[0.07] text-foreground',
              )}
            >
              {u === 'px' ? 'px' : 'Flag'}
            </button>
          ))}
        </div>
      }
    >
      <div className='grid grid-cols-2 gap-2'>
        <NumberField label='X' value={x} {...across} onCommit={(v) => actions.setFrame({ x: v * ux })} />
        <NumberField label='Y' value={y} {...down} onCommit={(v) => actions.setFrame({ y: v * uy })} />
        <NumberField label='W' value={w} {...across} min={field.precision * 10} onCommit={(v) => size({ w: v })} />
        <div className='relative'>
          <NumberField label='H' value={h} {...down} min={field.precision * 10} onCommit={(v) => size({ h: v })} />
          <button
            type='button'
            aria-label={linked ? 'Unlink width and height' : 'Link width and height'}
            aria-pressed={linked}
            title={linked ? 'Width and height change together' : 'Width and height change apart'}
            onClick={() => setLinked(!linked)}
            className={cn(
              'absolute -left-[13px] top-1/2 grid size-[18px] -translate-y-1/2 cursor-pointer place-items-center rounded-[5px] bg-surface text-muted-foreground shadow-[0_0_0_1px_var(--border)] hover:text-foreground [&_svg]:size-3',
              linked && 'bg-main-soft text-main shadow-none hover:text-main',
            )}
          >
            <Proportions />
          </button>
        </div>
        {turns ? <NumberField label='°' value={frame.rotation} wrap onCommit={(v) => actions.setFrame({ rotation: v })} /> : <span />}
        <div className='flex items-center justify-end gap-0.5'>
          <ToolButton label='Flip horizontally' onClick={() => actions.flip('x')}>
            <FlipHorizontal />
          </ToolButton>
          <ToolButton label='Flip vertically' onClick={() => actions.flip('y')}>
            <FlipVertical />
          </ToolButton>
          <ToolButton label='Rotate 90°' onClick={() => actions.rotateBy(90)}>
            <RotateQuarter />
          </ToolButton>
        </div>
      </div>
    </Section>
  );
}

/**
 * A number typed in and set on Enter or leaving the field. It takes sums ("1200 - 80", "2/3"), and
 * "%" or "px" after a number. Arrow keys step it, ten steps with Shift; Escape puts it back.
 */
function NumberField({
  label,
  value,
  onCommit,
  step = 1,
  min,
  wrap,
  precision = 0.1,
  format = (n) => String(round(n)),
  percent = 1,
  px = 1,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  min?: number;
  /** Angles: kept between -180 and 180. */
  wrap?: boolean;
  /** What it rounds to. */
  precision?: number;
  format?: (value: number) => string;
  /** What "100%" and "1px" come to in its units. */
  percent?: number;
  px?: number;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const tidy = (n: number) => {
    let v = min !== undefined ? Math.max(min, n) : n;
    if (wrap) v = ((((v + 180) % 360) + 360) % 360) - 180;
    return Math.round(v / precision) * precision;
  };
  const changed = (n: number) => Math.abs(n - value) >= precision / 2;
  const parse = (text: string) => evaluate(text, { percent, px });
  const commit = () => {
    const n = draft === null ? null : parse(draft);
    setDraft(null);
    if (n !== null && changed(tidy(n))) onCommit(tidy(n));
  };
  return (
    <label className='vx-well flex h-8 min-w-0 cursor-text items-center gap-1.5 rounded-[9px] pl-2.5 pr-2 text-[13px] focus-within:ring-2 focus-within:ring-ring'>
      <span className='w-3 shrink-0 text-[12px] font-medium text-muted-foreground'>{label}</span>
      <input
        inputMode='decimal'
        aria-label={label === '°' ? 'Rotation' : label}
        value={draft ?? format(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            setDraft(null);
            // Leave without setting what was typed.
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const from = (draft === null ? null : parse(draft)) ?? value;
            const next = tidy(from + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
            setDraft(null);
            if (changed(next)) onCommit(next);
          }
        }}
        className='min-w-0 flex-1 bg-transparent tabular-nums outline-none'
      />
    </label>
  );
}

/** Colours, paint and the settings of whatever kind of thing is selected. */
function AppearanceSections({ studio }: { studio: Studio }) {
  const { selectedLayers, selectedGroup, actions } = studio;
  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const allShapes = selectedLayers.every((l) => l.shape);
  const allText = selectedLayers.every((l) => l.text);
  const anyShape = selectedLayers.some((l) => l.shape);

  if (allShapes) {
    const settings = single && !single.text && hasShapeSettings(single) ? single : null;
    return (
      <>
        {allText && (
          <Section title='Text'>
            <div className='-mx-2 flex flex-wrap items-center gap-0.5'>
              <TextControls studio={studio} layers={selectedLayers} side='left' inlineSettings />
            </div>
            <TextSettings studio={studio} text={selectedLayers[0].text!} />
          </Section>
        )}
        <Section title='Paint'>
          <div className='-mx-2 flex flex-wrap items-center gap-0.5'>
            <ShapeControls studio={studio} layers={selectedLayers} side='left' inlineSettings />
            <PathControls studio={studio} />
          </div>
          {settings && <ShapeSettingsFields studio={studio} layer={settings} className='pt-1' />}
        </Section>
      </>
    );
  }

  const outlined = selectedLayers.find((l) => l.outline);
  return (
    <>
      <Section
        title='Colours'
        action={
          <ToolButton label='Match the flag’s colours' onClick={actions.matchPalette} className='-mr-2 h-6 text-[12px]'>
            <WandSparkles />
            <span>Match</span>
          </ToolButton>
        }
      >
        <div className='flex flex-wrap items-center gap-1.5'>
          {single && !selectedGroup ? <LayerSwatches studio={studio} layer={single} size={26} side='left' /> : <SelectionSwatches studio={studio} size={26} side='left' />}
        </div>
      </Section>
      {/* Shapes have their own stroke. */}
      {!anyShape && (
        <Section title='Outline' action={<Switch aria-label='Outline' checked={Boolean(outlined)} onCheckedChange={actions.toggleOutline} />}>
          {outlined && <OutlineControls studio={studio} layer={outlined} />}
        </Section>
      )}
    </>
  );
}

function FlagInspector({ studio, onOpenLayout }: { studio: Studio; onOpenLayout: () => void }) {
  const { actions } = studio;
  return (
    <>
      <Header title='Flag' />
      <Section
        title='Colours'
        action={
          <ToolButton label='Shuffle colours' onClick={actions.cycleFieldColors} className='-mr-2 h-6'>
            <SwapColors />
          </ToolButton>
        }
      >
        <div className='flex flex-wrap items-center gap-1.5'>
          <FieldSwatches studio={studio} size={26} side='left' />
        </div>
      </Section>
      <Section title='Field'>
        <ToolButton label='Edit stripes, crosses and other divisions' onClick={onOpenLayout} className='-ml-2 self-start'>
          <SquaresFour />
          <span>Edit field</span>
        </ToolButton>
      </Section>
      <p className='px-4 pb-4 text-[12.5px] text-muted-foreground'>Select something on the flag to change it here.</p>
    </>
  );
}
