'use client';

import React from 'react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlignBottom,
  AlignCentre,
  AlignLeft,
  AlignMiddle,
  AlignRight,
  AlignTop,
  ArcIcon,
  PathIcon,
  BezierCurve,
  BringForward,
  DistributeHorizontal,
  DistributeVertical,
  FitInto,
  Proportions,
  ClipMask,
  ClippedBelow,
  ColumnsIcon,
  Eye,
  EyeSlash,
  FlagTriangleRight,
  ExcludeShapes,
  FlipVertical,
  GridIcon,
  GroupIcon,
  IntersectShapes,
  Lock,
  MergeShapes,
  NoClip,
  RingIcon,
  RowsIcon,
  SendBackward,
  Shapes,
  SlidersHorizontal,
  SubtractShapes,
  SwapColors,
  Text,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  TextBold,
  TextItalic,
  Trash2,
  Ungroup,
  Unlock,
  X,
  ChevronDown,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import type { FieldPartRef, StudioClip, StudioDesign, StudioLayer, StudioRepeat, StudioText } from '@/lib/studio-design';
import { clipTargets } from './clip';
import { DIVISIONS, divisionParts } from './divisions';
import { FontPicker, GradientStops, PaintButton, Segmented, WidthSlider } from './draw';
import { PartPreview } from './FlagArt';
import { documentColors, fieldColors, flagWidth, gridCount, gridShape, layerWidth } from './model';
import { guideLine } from './repeats';
import { alignScopes, type AlignScope } from './regions';
import { defaultStroke, isLinear, naturalAspect } from './shapes';
import { ColorPicker, Slider, Swatch, ToolButton, ToolDivider, type Side } from './ui';
import type { AlignEdge, ColorSlot, SelectionColor, Studio } from './use-studio';
import { fontChoice } from './text';
import { SvgImportError } from './import-svg';
import { BOOLEAN_LABELS, canEditPoints, isOutline, type BooleanOp } from './vector';

/** A colour swatch that opens the picker. `onChange` is live; the popover closing commits. */
export function ColorButton({
  color,
  studio,
  onChange,
  size = 22,
  side = 'top',
  label,
  defaultOpen,
  onOpenChange,
}: {
  color: string;
  studio: Studio;
  onChange: (color: string, transient: boolean) => void;
  size?: number;
  side?: Side;
  label: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = React.useState(Boolean(defaultOpen));
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
        if (!next) studio.history.commit();
      }}
    >
      <PopoverTrigger asChild>
        <Swatch color={color} size={size} aria-label={label} active={open} className='rounded-[7px]' />
      </PopoverTrigger>
      <PopoverContent side={side} sideOffset={10} className='w-auto p-3' onOpenAutoFocus={(e) => e.preventDefault()}>
        <ColorPicker
          value={color}
          documentColors={documentColors(studio.design)}
          onChange={(next) => onChange(next, true)}
          onCommit={studio.history.commit}
        />
      </PopoverContent>
    </Popover>
  );
}

const MAX_SWATCHES = 5;

export function LayerSwatches({ studio, layer, size, side }: { studio: Studio; layer: StudioLayer; size?: number; side?: Side }) {
  const shown = layer.colors.slice(0, MAX_SWATCHES);
  return (
    <>
      {shown.map((color, i) => (
        <ColorButton
          key={i}
          color={color}
          studio={studio}
          size={size}
          side={side}
          label={`Colour ${i + 1}`}
          onChange={(next, transient) => studio.actions.setLayerColor(layer.id, i, next, { transient })}
        />
      ))}
    </>
  );
}

/** The colours across everything selected; changing one repaints it wherever the selection uses it. */
export function SelectionSwatches({ studio, size, side }: { studio: Studio; size?: number; side?: Side }) {
  return (
    <>
      {studio.selectionColors.slice(0, MAX_SWATCHES).map((entry, i) => (
        <SelectionSwatch key={`${entry.slots[0].id}:${entry.slots[0].index}`} studio={studio} entry={entry} label={`Colour ${i + 1}`} size={size} side={side} />
      ))}
    </>
  );
}

function SelectionSwatch({
  studio,
  entry,
  label,
  size,
  side,
}: {
  studio: Studio;
  entry: SelectionColor;
  label: string;
  size?: number;
  side?: Side;
}) {
  // The slots it was in when the picker opened, kept while it's open.
  const held = React.useRef<ColorSlot[] | null>(null);
  return (
    <ColorButton
      color={entry.color}
      studio={studio}
      size={size}
      side={side}
      label={label}
      onOpenChange={(open) => (held.current = open ? entry.slots : null)}
      onChange={(next, transient) => studio.actions.setSelectionColor(held.current ?? entry.slots, next, { transient })}
    />
  );
}

/** The selected division's colours, or every colour the field shows. */
export function FieldSwatches({ studio, size, side }: { studio: Studio; size?: number; side?: Side }) {
  const division = studio.selectedDivision;
  if (division) {
    const shown = division.colors.slice(0, DIVISIONS[division.kind].cycles ? divisionParts(division) : 1);
    return (
      <>
        {shown.map((color, i) => (
          <ColorButton
            key={i}
            color={color}
            studio={studio}
            size={size}
            side={side}
            label={`Colour ${i + 1}`}
            onChange={(next, transient) => studio.actions.setDivisionColor(division.id, i, next, { transient })}
          />
        ))}
        {division.fimbriation && (
          <ColorButton
            color={division.fimbriation.color}
            studio={studio}
            size={size}
            side={side}
            label='Fimbriation'
            onChange={(next, transient) =>
              studio.actions.setFieldPartColor({ divisionId: division.id, slot: 0, target: 'fimbriation' }, next, { transient })
            }
          />
        )}
      </>
    );
  }
  return (
    <>
      {fieldColors(studio.design).map((color, i) => (
        <ColorButton
          key={i}
          color={color}
          studio={studio}
          size={size}
          side={side}
          label={`Colour ${i + 1}`}
          onChange={(next, transient) => studio.actions.setFieldColor(i, next, { transient })}
        />
      ))}
    </>
  );
}

const REPEAT_MODES: { mode: StudioRepeat['mode'] | null; label: string; icon: React.ReactNode }[] = [
  { mode: null, label: 'Off', icon: <X /> },
  { mode: 'row', label: 'Row', icon: <ColumnsIcon /> },
  { mode: 'column', label: 'Column', icon: <RowsIcon /> },
  { mode: 'grid', label: 'Grid', icon: <GridIcon /> },
  { mode: 'ring', label: 'Ring', icon: <RingIcon /> },
  { mode: 'arc', label: 'Arc', icon: <ArcIcon /> },
  { mode: 'path', label: 'Along a path', icon: <PathIcon /> },
];

/** The repeat the toolbar edits: the whole group's when one is selected, else the one layer's. */
export function selectionRepeat(studio: Studio): { repeat: StudioRepeat | null } | null {
  if (studio.selectedGroup) return { repeat: studio.selectedGroup.repeat };
  return studio.selectedLayers.length === 1 ? { repeat: studio.selectedLayers[0].repeat ?? null } : null;
}

export function RepeatControls({ studio, className = 'w-[264px]' }: { studio: Studio; className?: string }) {
  const repeat = selectionRepeat(studio)?.repeat ?? null;
  const { setRepeat } = studio.actions;
  const live = (patch: Partial<StudioRepeat>) => setRepeat(patch, { transient: true });
  const slider = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, shown?: React.ReactNode) => (
    <Field label={label} value={shown}>
      <Slider label={label} min={min} max={max} step={step} value={value} onChange={set} onCommit={studio.history.commit} />
    </Field>
  );
  const toggle = (label: string, checked: boolean, set: (on: boolean) => void) => (
    <label className='flex items-center justify-between text-[12.5px] text-subtle'>
      {label}
      <Switch checked={checked} onCheckedChange={set} />
    </label>
  );
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      <div className='vx-well flex gap-0.5 rounded-[11px] p-[3px]'>
        {REPEAT_MODES.map(({ mode, label, icon }) => (
          <ToolButton
            key={label}
            label={label}
            active={(repeat?.mode ?? null) === mode}
            onClick={() => studio.actions.setRepeatMode(mode)}
            className={cn('h-8 flex-1', (repeat?.mode ?? null) === mode && 'vx-key bg-raised text-foreground hover:bg-raised hover:text-foreground')}
          >
            {icon}
          </ToolButton>
        ))}
      </div>
      {(repeat?.mode === 'row' || repeat?.mode === 'column') && (
        <>
          {slider('Copies', repeat.count, 2, 24, 1, (count) => live({ count }), repeat.count)}
          {slider('Spacing', repeat.spacing, -0.4, 2, 0.005, (spacing) => live({ spacing }))}
        </>
      )}
      {repeat?.mode === 'grid' && <GridControls repeat={repeat} slider={slider} toggle={toggle} live={live} set={setRepeat} />}
      {(repeat?.mode === 'ring' || repeat?.mode === 'arc') && <RingControls repeat={repeat} slider={slider} toggle={toggle} live={live} set={setRepeat} />}
      {repeat?.mode === 'path' && <AlongControls studio={studio} repeat={repeat} slider={slider} toggle={toggle} live={live} />}
    </div>
  );
}

type RepeatParts = {
  repeat: StudioRepeat;
  slider: (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, shown?: React.ReactNode) => React.ReactNode;
  toggle: (label: string, checked: boolean, set: (on: boolean) => void) => React.ReactNode;
  live: (patch: Partial<StudioRepeat>) => void;
  set?: (patch: Partial<StudioRepeat>) => void;
};

/** Columns × rows, how far apart, and staggered rows like the US's 50 stars. */
function GridControls({ repeat, slider, toggle, live, set }: RepeatParts) {
  const { columns, rows } = gridShape(repeat);
  return (
    <>
      <div className='grid grid-cols-2 gap-3'>
        {slider('Columns', columns, 1, 20, 1, (c) => live({ columns: c, rows }), columns)}
        {slider('Rows', rows, 1, 20, 1, (r) => live({ columns, rows: r }), rows)}
      </div>
      <div className='grid grid-cols-2 gap-3'>
        {slider('Across', repeat.spacing, -0.4, 2, 0.005, (spacing) => live({ spacing }))}
        {slider('Down', repeat.spacingY ?? repeat.spacing, -0.6, 2, 0.005, (spacingY) => live({ spacingY }))}
      </div>
      {toggle(`Stagger rows · ${repeat.columns ? repeat.count : gridCount(columns, rows, repeat.stagger)} copies`, Boolean(repeat.stagger), (stagger) =>
        set!({ stagger, columns, rows }),
      )}
    </>
  );
}

/** Copies on a ring or arc, how many rings share its centre, and which way it's turned. */
function RingControls({ repeat, slider, toggle, live, set }: RepeatParts) {
  const rings = repeat.rings ?? 1;
  const gap = repeat.ringGap ?? Math.max(0.05, Math.min(0.3, repeat.spacing * 0.6));
  return (
    <>
      <div className='grid grid-cols-2 gap-3'>
        {slider(rings > 1 ? 'Inner copies' : 'Copies', repeat.count, 2, 24, 1, (count) => live({ count }), repeat.count)}
        {slider('Radius', repeat.spacing, 0.02, 0.7, 0.005, (spacing) => live({ spacing }))}
      </div>
      <div className='grid grid-cols-2 gap-3'>
        {slider('Rings', rings, 1, 6, 1, (r) => live({ rings: r, ringGap: gap }), rings)}
        {rings > 1 && slider('Ring gap', gap, 0.01, 0.5, 0.005, (ringGap) => live({ ringGap }))}
      </div>
      <div className='grid grid-cols-2 gap-3'>
        {slider('Turn', repeat.angle ?? 0, -180, 180, 1, (angle) => live({ angle: Math.abs(angle) < 3 ? 0 : angle }), `${Math.round(repeat.angle ?? 0)}°`)}
        {repeat.mode === 'arc' && slider('Spread', repeat.spread ?? 150, 20, 360, 1, (spread) => live({ spread }), `${Math.round(repeat.spread ?? 150)}°`)}
      </div>
      {rings > 1 && toggle('More copies on outer rings', Boolean(repeat.even), (even) => set!({ even }))}
      {rings > 1 && repeat.mode === 'ring' && toggle('Stagger rings', Boolean(repeat.stagger), (stagger) => set!({ stagger }))}
      {toggle('Turn with the circle', repeat.facing, (facing) => set!({ facing }))}
    </>
  );
}

/** Which line the copies follow, how many, and where they start along it. */
function AlongControls({ studio, repeat, slider, toggle, live }: RepeatParts & { studio: Studio }) {
  const guides = studio.pathGuides;
  const guide = studio.design.layers.find((l) => l.id === repeat.along);
  const line = guide && guideLine(guide, flagWidth(studio.design));
  if (guides.length === 0 && !guide) {
    return <p className='text-[12.5px] leading-snug text-subtle'>Draw a line, curve or shape first, then the copies can follow it.</p>;
  }
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className='vx-well flex h-8 cursor-pointer items-center gap-2 rounded-[9px] px-2.5 text-left text-[12.5px]'>
          <PathIcon className='size-3.5 shrink-0 text-muted-foreground' />
          <span className='min-w-0 flex-1 truncate'>{guide ? guide.name : repeat.along ? 'Its path was deleted' : 'Pick a path to follow'}</span>
          <ChevronDown className='size-3 shrink-0 text-muted-foreground' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='max-h-72 w-[264px] overflow-y-auto'>
          <DropdownMenuRadioGroup value={repeat.along ?? ''} onValueChange={studio.actions.setGuide}>
            {[...guides].reverse().map((l) => (
              <DropdownMenuRadioItem key={l.id} value={l.id}>
                <span className='truncate'>{l.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {slider('Copies', repeat.count, 1, 60, 1, (count) => live({ count }), repeat.count)}
      {line?.closed
        ? slider('Start', repeat.spacing, 0, 1, 0.005, (spacing) => live({ spacing }))
        : slider('Inset from the ends', Math.min(0.45, Math.max(0, repeat.spacing)), 0, 0.45, 0.005, (spacing) => live({ spacing }))}
      {toggle('Turn with the path', repeat.facing, (facing) => studio.actions.setRepeat({ facing }))}
      {guide && toggle('Show the path', !guide.hidden, studio.actions.showGuide)}
    </>
  );
}

export function OutlineControls({ studio, layer }: { studio: Studio; layer: StudioLayer }) {
  if (!layer.outline) return null;
  return (
    <div className='flex flex-col gap-3'>
      <Field label='Width'>
        <Slider
          label='Width'
          min={0.002}
          max={0.05}
          step={0.001}
          value={layer.outline.width}
          onChange={(width) => studio.actions.setOutline({ width }, { transient: true })}
          onCommit={studio.history.commit}
        />
      </Field>
      <ColorPicker
        value={layer.outline.color}
        documentColors={documentColors(studio.design)}
        onChange={(color) => studio.actions.setOutline({ color }, { transient: true })}
        onCommit={studio.history.commit}
      />
    </div>
  );
}

/**
 * Fill, stroke and the shape's own settings, for selected shapes and brush strokes. With
 * `inlineSettings` the settings are left to be shown elsewhere rather than in a popover.
 */
export function ShapeControls({ studio, layers, side = 'top', inlineSettings }: { studio: Studio; layers: StudioLayer[]; side?: Side; inlineSettings?: boolean }) {
  const { actions } = studio;
  const first = layers[0];
  const shape = first.shape!;
  const brushes = layers.every((l) => l.shape?.kind === 'brush');
  const stroked = shape.stroke > 0;
  const strokeOn = () => defaultStroke(layerWidth(first), first.size);
  const gradient = shape.fill ? (shape.gradient ?? null) : null;
  // Which end of a gradient the picker paints.
  const [stop, setStop] = React.useState<0 | 2>(0);
  const fillIndex = gradient ? stop : 0;
  const [from, to] = [first.colors[0], first.colors[2] ?? first.colors[0]];
  const swap = () => {
    actions.setShapeColor(0, to, { transient: true });
    actions.setShapeColor(2, from);
  };
  return (
    <>
      {!brushes && (
        <PaintButton
          studio={studio}
          side={side}
          label='Fill'
          color={first.colors[fillIndex] ?? first.colors[0]}
          paint={gradient ? `${gradient.kind === 'radial' ? 'radial-gradient(circle' : `linear-gradient(${gradient.angle + 90}deg`}, ${from}, ${to})` : undefined}
          on={shape.fill}
          // Something always shows: losing the fill brings in a stroke, and the other way round.
          onToggle={(fill) => actions.setShape({ fill, ...(!fill && !stroked && { stroke: strokeOn() }) })}
          onColor={(color, transient) => {
            actions.setShapeColor(fillIndex, color, { transient });
            if (!shape.fill) actions.setShape({ fill: true }, { transient });
          }}
        >
          {shape.fill && (
            <Segmented
              label='Fill type'
              value={gradient?.kind ?? 'solid'}
              options={[
                { value: 'solid', label: 'Solid' },
                { value: 'linear', label: 'Linear' },
                { value: 'radial', label: 'Radial' },
              ]}
              onChange={(kind) => {
                actions.setGradient(kind === 'solid' ? null : { kind, angle: gradient?.angle ?? 90 });
                if (kind === 'solid') setStop(0);
              }}
            />
          )}
          {gradient && <GradientStops from={from} to={to} stop={stop} onStop={setStop} onSwap={swap} />}
          {gradient?.kind === 'linear' && (
            <label className='flex flex-col gap-1'>
              <span className='flex justify-between text-[12.5px] text-subtle'>
                Angle
                <span className='tabular-nums text-muted-foreground'>{Math.round(gradient.angle)}°</span>
              </span>
              <Slider
                label='Angle'
                min={0}
                max={360}
                step={1}
                value={gradient.angle}
                // Settles on the eighths of a turn.
                onChange={(angle) => actions.setGradient({ ...gradient, angle: Math.abs(angle - Math.round(angle / 45) * 45) < 4 ? Math.round(angle / 45) * 45 : angle }, { transient: true })}
                onCommit={studio.history.commit}
              />
            </label>
          )}
        </PaintButton>
      )}
      <PaintButton
        studio={studio}
        side={side}
        label={brushes ? 'Colour' : 'Stroke'}
        ring={!brushes}
        color={first.colors[1] ?? first.colors[0]}
        on={stroked}
        onToggle={brushes ? undefined : (on) => actions.setShape({ stroke: on ? strokeOn() : 0, ...(!on && !shape.fill && { fill: true }) })}
        onColor={(color, transient) => {
          actions.setShapeColor(1, color, { transient });
          if (!stroked) actions.setShape({ stroke: strokeOn() }, { transient });
        }}
      >
        {stroked && (
          <>
            <WidthSlider
              studio={studio}
              label={brushes ? 'Size' : 'Width'}
              value={shape.stroke}
              max={brushes ? 0.08 : 0.06}
              onChange={(stroke) => actions.setShape({ stroke }, { transient: true })}
            />
            <Segmented
              label='Stroke style'
              value={shape.strokeStyle ?? 'solid'}
              options={[
                { value: 'solid', label: 'Solid' },
                { value: 'dashed', label: 'Dashed' },
                { value: 'dotted', label: 'Dotted' },
                { value: 'double', label: 'Double' },
              ]}
              onChange={(style) => actions.setShape({ strokeStyle: style === 'solid' ? undefined : style })}
            />
          </>
        )}
      </PaintButton>
      {layers.length === 1 && !inlineSettings && <ShapeSettings studio={studio} layer={first} />}
    </>
  );
}

/** How opaque the selected layers are, as the first of them is. */
export const selectionOpacity = (studio: Studio) => studio.selectedLayers[0]?.opacity ?? 1;

/** A slider for how opaque the selected layers are drawn. */
export function OpacitySlider({ studio }: { studio: Studio }) {
  return (
    <Slider
      label='Opacity'
      min={0}
      max={1}
      step={0.01}
      value={selectionOpacity(studio)}
      onChange={(opacity) => studio.actions.setOpacity(opacity, { transient: true })}
      onCommit={studio.history.commit}
    />
  );
}

const BOOLEANS: { op: BooleanOp; hint: string; icon: React.ReactNode }[] = [
  { op: 'unite', hint: 'join them into one', icon: <MergeShapes /> },
  { op: 'subtract', hint: 'cut the others out of the bottom one', icon: <SubtractShapes /> },
  { op: 'intersect', hint: 'keep where they overlap', icon: <IntersectShapes /> },
  { op: 'exclude', hint: 'keep where they don’t overlap', icon: <ExcludeShapes /> },
];

/**
 * Editing a shape's outline: its points when one is selected, or combining several into one.
 * Brush strokes are left out.
 */
export function PathControls({ studio, side = 'top' }: { studio: Studio; side?: Side }) {
  const shapes = studio.selectedLayers.filter((l) => isOutline(l) && !l.locked && !l.hidden);
  if (shapes.length === 1 && studio.selectedLayers.length === 1) {
    if (!canEditPoints(shapes[0])) return null;
    return (
      <ToolButton label='Edit points (Enter)' side={side} onClick={() => studio.actions.editPoints(shapes[0].id)}>
        <BezierCurve />
      </ToolButton>
    );
  }
  if (shapes.length < 2) return null;
  const combine = async (op: BooleanOp) => {
    if (!(await studio.actions.combine(op))) toast(op === 'intersect' ? 'Those shapes don’t overlap' : 'Nothing would be left');
  };
  return (
    <>
      {BOOLEANS.map((b) => (
        <ToolButton key={b.op} label={`${BOOLEAN_LABELS[b.op]}: ${b.hint}`} side={side} onClick={() => combine(b.op)}>
          {b.icon}
        </ToolButton>
      ))}
    </>
  );
}

const TEXT_ALIGN: { align: StudioText['align']; label: string; icon: React.ReactNode }[] = [
  { align: 'left', label: 'Align left', icon: <TextAlignLeft /> },
  { align: 'center', label: 'Centre', icon: <TextAlignCenter /> },
  { align: 'right', label: 'Align right', icon: <TextAlignRight /> },
];

/** The words, face and setting of selected text; with `inlineSettings` the setting is left to be shown elsewhere. */
export function TextControls({ studio, layers, side = 'top', inlineSettings }: { studio: Studio; layers: StudioLayer[]; side?: Side; inlineSettings?: boolean }) {
  const { actions, history } = studio;
  const text = layers[0].text!;
  const font = fontChoice(text.font);
  return (
    <>
      {layers.length === 1 && <TextEditButton studio={studio} layer={layers[0]} side={side} />}
      <FontPicker value={text.font} side={side} onChange={(f) => actions.setText({ font: f })} />
      <ToolButton label='Bold' side={side} active={Boolean(text.bold && font.bold)} disabled={!font.bold} onClick={() => actions.setText({ bold: !text.bold })}>
        <TextBold />
      </ToolButton>
      <ToolButton
        label='Italic'
        side={side}
        active={Boolean(text.italic && font.italic)}
        disabled={!font.italic}
        onClick={() => actions.setText({ italic: !text.italic })}
      >
        <TextItalic />
      </ToolButton>
      {!inlineSettings && (
        <ToolPopover label='Text settings' icon={<SlidersHorizontal />} iconOnly side={side} onClose={history.commit}>
          <TextSettings studio={studio} text={text} className='w-[248px]' />
        </ToolPopover>
      )}
    </>
  );
}

/** How selected text is set: alignment, spacing and curve. */
export function TextSettings({ studio, text, className }: { studio: Studio; text: StudioText; className?: string }) {
  const { actions, history } = studio;
  const live = (patch: Partial<StudioText>) => actions.setText(patch, { transient: true });
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className='flex items-center gap-0.5'>
        {TEXT_ALIGN.map((a) => (
          <ToolButton key={a.align} label={a.label} active={text.align === a.align} onClick={() => actions.setText({ align: a.align })}>
            {a.icon}
          </ToolButton>
        ))}
      </div>
      <Field label='Letter spacing' value={`${Math.round(text.spacing * 100)}%`}>
        <Slider label='Letter spacing' min={-0.2} max={1} step={0.01} value={text.spacing} onChange={(spacing) => live({ spacing })} onCommit={history.commit} />
      </Field>
      {text.content.includes('\n') && (
        <Field label='Line height' value={text.leading.toFixed(2)}>
          <Slider label='Line height' min={0.6} max={3} step={0.05} value={text.leading} onChange={(leading) => live({ leading })} onCommit={history.commit} />
        </Field>
      )}
      <Field label='Curve' value={`${Math.round(text.curve)}°`}>
        <Slider label='Curve' min={-360} max={360} step={1} value={text.curve} onChange={(curve) => live({ curve })} onCommit={history.commit} />
      </Field>
      <span className='-mt-1 text-[12px] text-muted-foreground'>Bend it up into an arch, or down into a smile. 360° goes all the way round.</span>
    </div>
  );
}

/** The words themselves, open while the text is being typed. */
function TextEditButton({ studio, layer, side }: { studio: Studio; layer: StudioLayer; side: Side }) {
  const { actions } = studio;
  const open = studio.textEdit?.id === layer.id;
  // Kept here so typing runs ahead of a font still loading.
  const [value, setValue] = React.useState(layer.text!.content);
  React.useEffect(() => {
    if (!open) setValue(layer.text!.content);
  }, [open, layer.text]);
  return (
    <Popover open={open} onOpenChange={(next) => (next ? actions.editText(layer.id) : actions.stopEditingText())}>
      <PopoverTrigger asChild>
        <ToolButton label='Edit text (Enter)' side={side} active={open}>
          <Text />
          <span>Edit</span>
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent side={side} sideOffset={10} className='w-auto p-2'>
        <Textarea
          autoFocus
          dir='auto'
          aria-label='Text'
          className='min-h-[72px] w-[280px] resize-none text-[15px]'
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setValue(e.target.value);
            actions.setText({ content: e.target.value }, { transient: true });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              actions.stopEditingText();
            }
          }}
        />
        <p className='px-1 pt-1.5 text-[12px] text-muted-foreground'>Enter for a new line · ⌘Enter when done</p>
      </PopoverContent>
    </Popover>
  );
}

/** While a path's points are being edited: what can be done, and a way out. */
export function PointEditBar({ studio, side = 'top' }: { studio: Studio; side?: Side }) {
  const { pathEdit, actions } = studio;
  if (!pathEdit) return null;
  return (
    <>
      <ShapeControls studio={studio} layers={[pathEdit.layer]} side={side} />
      <ToolDivider />
      {pathEdit.nodes.length > 0 && (
        <>
          <ToolButton label='Delete points' side={side} onClick={actions.deleteNodes}>
            <Trash2 />
          </ToolButton>
          <ToolDivider />
        </>
      )}
      <ToolButton label='Done (Enter)' side={side} onClick={actions.stopEditing} className='text-main hover:text-main'>
        <span>Done</span>
      </ToolButton>
    </>
  );
}

/** Whether a shape has settings of its own: points, sides, corners or weight. */
export const hasShapeSettings = (layer: StudioLayer) => {
  const kind = layer.shape?.kind;
  return kind === 'star' || kind === 'polygon' || kind === 'rect' || (kind !== undefined && isLinear(kind));
};

/** Points, sides, corners or weight, for the shapes that have them. */
function ShapeSettings({ studio, layer }: { studio: Studio; layer: StudioLayer }) {
  if (!hasShapeSettings(layer)) return null;
  return (
    <ToolPopover label='Shape' icon={<SlidersHorizontal />} iconOnly>
      <ShapeSettingsFields studio={studio} layer={layer} className='w-[220px]' />
    </ToolPopover>
  );
}

/** The sliders behind `ShapeSettings`, for showing them in place. */
export function ShapeSettingsFields({ studio, layer, className }: { studio: Studio; layer: StudioLayer; className?: string }) {
  const shape = layer.shape!;
  const { kind } = shape;
  const { history } = studio;
  // A shape at its own proportions stays there as its points change; a stretched one stays stretched.
  const reshape = (patch: Partial<NonNullable<StudioLayer['shape']>>) =>
    studio.updateLayers(
      [layer.id],
      (l) => {
        const next = { ...l.shape!, ...patch };
        const regular = Math.abs(layerWidth(l) / l.size - naturalAspect(l.shape!)) < 0.01;
        return { ...l, shape: next, ...(regular && { aspect: naturalAspect(next), stretch: undefined }) };
      },
      { transient: true },
    );
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      {(kind === 'star' || kind === 'polygon') && (
        <Field label={kind === 'star' ? 'Points' : 'Sides'} value={shape.points}>
          <Slider
            label={kind === 'star' ? 'Points' : 'Sides'}
            min={3}
            max={kind === 'star' ? 24 : 12}
            step={1}
            value={shape.points ?? (kind === 'star' ? 5 : 6)}
            onChange={(points) => reshape({ points })}
            onCommit={history.commit}
          />
        </Field>
      )}
      {kind === 'star' && (
        <Field label='Thickness'>
          <Slider label='Thickness' min={0.15} max={0.95} step={0.01} value={shape.inner ?? 0.382} onChange={(inner) => reshape({ inner })} onCommit={history.commit} />
        </Field>
      )}
      {kind === 'rect' && (
        <Field label='Corners'>
          <Slider label='Corners' min={0} max={1} step={0.01} value={shape.corner ?? 0} onChange={(corner) => reshape({ corner })} onCommit={history.commit} />
        </Field>
      )}
      {isLinear(kind) && (
        <WidthSlider studio={studio} label='Weight' min={0.003} max={0.25} value={layer.size} onChange={(size) => studio.actions.setWeight(size, { transient: true })} />
      )}
    </div>
  );
}

const ALIGN: { edge: AlignEdge; label: string; icon: React.ReactNode }[] = [
  { edge: 'left', label: 'Left', icon: <AlignLeft /> },
  { edge: 'centre', label: 'Centre', icon: <AlignCentre /> },
  { edge: 'right', label: 'Right', icon: <AlignRight /> },
  { edge: 'top', label: 'Top', icon: <AlignTop /> },
  { edge: 'middle', label: 'Middle', icon: <AlignMiddle /> },
  { edge: 'bottom', label: 'Bottom', icon: <AlignBottom /> },
];

/** Line the selection up with itself, the part of the field it's in, or the flag. */
export function AlignControls({ studio, className = 'w-[248px]' }: { studio: Studio; className?: string }) {
  const layers = studio.selectedLayers.filter((l) => !l.locked && !l.hidden);
  const scopes = alignScopes(studio.design, layers);
  const [picked, setPicked] = React.useState<AlignScope['id']>(scopes[0].id);
  const scope = scopes.find((s) => s.id === picked) ?? scopes[0];
  const { actions } = studio;
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {scopes.length > 1 && (
        <div className='vx-well flex gap-0.5 rounded-[11px] p-[3px]'>
          {scopes.map((s) => (
            <button
              key={s.id}
              type='button'
              onClick={() => setPicked(s.id)}
              className={cn(
                'h-7 min-w-0 flex-1 cursor-pointer truncate rounded-[8px] px-2 text-[12.5px] font-medium text-subtle transition-colors hover:text-foreground',
                s.id === scope.id && 'vx-key bg-raised text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className='flex items-center justify-between'>
        {ALIGN.map(({ edge, label, icon }, i) => (
          <React.Fragment key={edge}>
            {i === 3 && <ToolDivider />}
            <ToolButton label={label} onClick={() => actions.align(edge, scope.box)}>
              {icon}
            </ToolButton>
          </React.Fragment>
        ))}
      </div>
      {(layers.length > 2 || scope.box) && (
        <div className='flex items-center gap-0.5 border-t border-line pt-2'>
          {layers.length > 2 && (
            <>
              <ToolButton label='Space evenly across' onClick={() => actions.distribute('x')}>
                <DistributeHorizontal />
              </ToolButton>
              <ToolButton label='Space evenly down' onClick={() => actions.distribute('y')}>
                <DistributeVertical />
              </ToolButton>
            </>
          )}
          <span className='flex-1' />
          {scope.box && (
            <ToolButton label={`Fit to ${scope.label.toLowerCase()}`} onClick={() => actions.fitTo(scope.box!)}>
              <FitInto />
              <span>Fit</span>
            </ToolButton>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, children }: { label: string; value?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className='flex flex-col gap-1'>
      <span className='flex justify-between text-[12.5px] text-subtle'>
        {label}
        {value !== undefined && <span className='tabular-nums text-muted-foreground'>{value}</span>}
      </span>
      {children}
    </label>
  );
}

function ToolPopover({
  label,
  icon,
  active,
  iconOnly,
  side = 'top',
  onClose,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  iconOnly?: boolean;
  side?: Side;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={(next) => (setOpen(next), !next && onClose?.())}>
      <PopoverTrigger asChild>
        <ToolButton label={label} side={side} active={active || open}>
          {icon}
          {!iconOnly && <span>{label}</span>}
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent side={side} sideOffset={10} className='w-auto p-3.5' onOpenAutoFocus={(e) => e.preventDefault()}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

const clipKey = (clip: StudioClip | null | undefined) =>
  !clip ? 'none' : clip.kind === 'below' ? 'below' : `part:${clip.divisionId}:${clip.part}`;

/** What a clip choice shows before its name, in one column: the part on the flag, or an icon. */
export function ClipChoiceArt({ design, part, icon }: { design: StudioDesign; part?: FieldPartRef; icon?: React.ReactNode }) {
  return (
    <span className='flex w-9 shrink-0 justify-center text-muted-foreground [&>svg:not([width])]:size-4'>
      {part ? <PartPreview design={design} part={part} className='rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.15)]' /> : icon}
    </span>
  );
}

/** What the selection only shows inside: nothing, the layer under it, or a part of the field. */
export function ClipSubmenu({ studio }: { studio: Studio }) {
  const { actions, selectedLayers, design } = studio;
  const keys = new Set(selectedLayers.map((l) => clipKey(l.clip)));
  const value = keys.size === 1 ? [...keys][0] : '';
  const targets = clipTargets(design);
  const bottom = selectedLayers.length === 1 && design.layers[0]?.id === selectedLayers[0].id;
  const choose = (key: string) => {
    if (key === 'none') return actions.setClip(null);
    if (key === 'below') return actions.setClip({ kind: 'below' });
    const target = targets.find((t) => clipKey({ kind: 'part', ...t.ref }) === key);
    if (target) actions.setClip({ kind: 'part', ...target.ref });
  };
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ClipMask /> Clip to
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent sideOffset={8} alignOffset={-6} className='max-h-(--radix-dropdown-menu-content-available-height) w-72 overflow-y-auto'>
        <DropdownMenuRadioGroup value={value} onValueChange={choose}>
          <DropdownMenuRadioItem value='none'>
            <ClipChoiceArt design={design} icon={<NoClip />} /> Nothing
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value='below' disabled={bottom}>
            <ClipChoiceArt design={design} icon={<ClippedBelow />} /> Layer below <span className='ml-auto pl-3 text-xs text-muted-foreground'>⌥⌘G</span>
          </DropdownMenuRadioItem>
          {targets.length > 0 && <DropdownMenuSeparator />}
          {targets.map((t) => {
            const key = clipKey({ kind: 'part', ...t.ref });
            return (
              <DropdownMenuRadioItem key={key} value={key}>
                <ClipChoiceArt design={design} part={t.ref} />
                <span className='truncate'>{t.label}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** Whether the selection is more than one thing that could become a group. */
export const canGroup = (studio: Studio) => !studio.selectedGroup && studio.selectedLayers.filter((l) => !l.locked).length > 1;

/** Turns an emblem into its shapes, saying why when it can't. */
export function makeShapes(studio: Studio, id: string) {
  toast.promise(studio.actions.convertToShapes(id), {
    loading: 'Turning it into shapes…',
    error: (error) => (error instanceof SvgImportError ? error.message : 'Couldn’t turn it into shapes.'),
  });
}

export function LayerMoreMenu({ studio, children, side = 'top' }: { studio: Studio; children: React.ReactNode; side?: Side }) {
  const { actions, selectedLayers } = studio;
  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} sideOffset={10} align='end' className='w-52'>
        <DropdownMenuItem onSelect={() => actions.flip('y')}>
          <FlipVertical /> Flip vertically
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.arrange('front')}>
          <BringForward /> Bring to front
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.arrange('back')}>
          <SendBackward /> Send to back
        </DropdownMenuItem>
        <ClipSubmenu studio={studio} />
        {canGroup(studio) && (
          <DropdownMenuItem onSelect={actions.group}>
            <GroupIcon /> Group <span className='ml-auto pl-3 text-xs text-muted-foreground'>⌘G</span>
          </DropdownMenuItem>
        )}
        {selectedLayers.some((l) => l.group) && (
          <DropdownMenuItem onSelect={actions.ungroup}>
            <Ungroup /> Ungroup <span className='ml-auto pl-3 text-xs text-muted-foreground'>⇧⌘G</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.resetLayerColors(selectedLayers.map((l) => l.id))}>
          <SwapColors /> Original colours
        </DropdownMenuItem>
        {selectedLayers.some((l) => l.text || (canEditPoints(l) && l.shape!.kind !== 'path')) && (
          <DropdownMenuItem onSelect={actions.convertToPath}>
            <BezierCurve /> Convert to path
          </DropdownMenuItem>
        )}
        {single && !single.locked && studio.canMakeShapes(single) && (
          <DropdownMenuItem onSelect={() => makeShapes(studio, single.id)}>
            <Shapes /> Convert to shapes
          </DropdownMenuItem>
        )}
        {single && canEditPoints(single) && (
          <DropdownMenuItem onSelect={() => actions.useAsFlagOutline(single.id)}>
            <FlagTriangleRight /> Use as flag shape
          </DropdownMenuItem>
        )}
        {selectedLayers.some((l) => l.stretch) && (
          <DropdownMenuItem onSelect={actions.unstretch}>
            <Proportions /> Original proportions
          </DropdownMenuItem>
        )}
        {single && (
          <>
            <DropdownMenuItem onSelect={() => actions.toggleLocked(single.id)}>
              {single.locked ? <Unlock /> : <Lock />} {single.locked ? 'Unlock' : 'Lock'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.toggleHidden(single.id)}>
              {single.hidden ? <Eye /> : <EyeSlash />} {single.hidden ? 'Show' : 'Hide'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
