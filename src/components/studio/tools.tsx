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
  BezierCurve,
  BringForward,
  DistributeHorizontal,
  DistributeVertical,
  FitInto,
  Proportions,
  ClipMask,
  ClippedBelow,
  ColumnsIcon,
  Copy,
  Eye,
  EyeSlash,
  FlagTriangleRight,
  ExcludeShapes,
  FlipHorizontal,
  FlipVertical,
  GridIcon,
  GroupIcon,
  IntersectShapes,
  Lock,
  MergeShapes,
  NoClip,
  MoreHorizontal,
  Outline,
  Repeat,
  RingIcon,
  RotateQuarter,
  RowsIcon,
  SendBackward,
  SlidersHorizontal,
  SquaresFour,
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
  WandSparkles,
  X,
  ChevronDown,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import type { FieldPartRef, StudioClip, StudioDesign, StudioLayer, StudioRepeat, StudioText } from '@/lib/studio-design';
import { clipTargets } from './clip';
import { DIVISIONS, divisionParts } from './divisions';
import { FontPicker, PaintButton, WidthSlider } from './draw';
import { PartPreview } from './FlagArt';
import { documentColors, fieldColors, layerWidth } from './model';
import { alignScopes, type AlignScope } from './regions';
import { defaultStroke, isLinear, naturalAspect } from './shapes';
import { ColorPicker, Slider, Swatch, ToolButton, ToolDivider } from './ui';
import type { Rect } from './StudioCanvas';
import type { AlignEdge, ColorSlot, SelectionColor, Studio } from './use-studio';
import { fontChoice } from './text';
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
  side?: 'top' | 'bottom' | 'left' | 'right';
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

export function LayerSwatches({ studio, layer, size, side }: { studio: Studio; layer: StudioLayer; size?: number; side?: 'top' | 'bottom' }) {
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
export function SelectionSwatches({ studio, size, side }: { studio: Studio; size?: number; side?: 'top' | 'bottom' }) {
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
  side?: 'top' | 'bottom';
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
export function FieldSwatches({ studio, size, side }: { studio: Studio; size?: number; side?: 'top' | 'bottom' }) {
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
];

/** The repeat the toolbar edits: the whole group's when one is selected, else the one layer's. */
export function selectionRepeat(studio: Studio): { repeat: StudioRepeat | null } | null {
  if (studio.selectedGroup) return { repeat: studio.selectedGroup.repeat };
  return studio.selectedLayers.length === 1 ? { repeat: studio.selectedLayers[0].repeat ?? null } : null;
}

export function RepeatControls({ studio }: { studio: Studio }) {
  const repeat = selectionRepeat(studio)?.repeat ?? null;
  const radial = repeat && (repeat.mode === 'ring' || repeat.mode === 'arc');
  return (
    <div className='flex w-[248px] flex-col gap-3.5'>
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
      {repeat && (
        <>
          <Field label='Copies' value={repeat.count}>
            <Slider
              label='Copies'
              min={2}
              max={repeat.mode === 'grid' ? 36 : 24}
              step={1}
              value={repeat.count}
              onChange={(count) => studio.actions.setRepeat({ count }, { transient: true })}
              onCommit={studio.history.commit}
            />
          </Field>
          <Field label={radial ? 'Radius' : 'Spacing'}>
            <Slider
              label={radial ? 'Radius' : 'Spacing'}
              min={radial ? 0.04 : -0.4}
              max={radial ? 0.7 : 2}
              step={0.005}
              value={repeat.spacing}
              onChange={(spacing) => studio.actions.setRepeat({ spacing }, { transient: true })}
              onCommit={studio.history.commit}
            />
          </Field>
          {radial && (
            <label className='flex items-center justify-between text-[12.5px] text-subtle'>
              Turn with the circle
              <Switch checked={repeat.facing} onCheckedChange={(facing) => studio.actions.setRepeat({ facing })} />
            </label>
          )}
        </>
      )}
    </div>
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

/** Fill, stroke and the shape's own settings, for selected shapes and brush strokes. */
export function ShapeControls({ studio, layers, side = 'top' }: { studio: Studio; layers: StudioLayer[]; side?: 'top' | 'bottom' }) {
  const { actions } = studio;
  const first = layers[0];
  const shape = first.shape!;
  const brushes = layers.every((l) => l.shape?.kind === 'brush');
  const stroked = shape.stroke > 0;
  const strokeOn = () => defaultStroke(layerWidth(first), first.size);
  return (
    <>
      {!brushes && (
        <PaintButton
          studio={studio}
          side={side}
          label='Fill'
          color={first.colors[0]}
          on={shape.fill}
          // Something always shows: losing the fill brings in a stroke, and the other way round.
          onToggle={(fill) => actions.setShape({ fill, ...(!fill && !stroked && { stroke: strokeOn() }) })}
          onColor={(color, transient) => {
            actions.setShapeColor(0, color, { transient });
            if (!shape.fill) actions.setShape({ fill: true }, { transient });
          }}
        />
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
          <WidthSlider
            studio={studio}
            label={brushes ? 'Size' : 'Width'}
            value={shape.stroke}
            max={brushes ? 0.08 : 0.06}
            onChange={(stroke) => actions.setShape({ stroke }, { transient: true })}
          />
        )}
      </PaintButton>
      {layers.length === 1 && <ShapeSettings studio={studio} layer={first} />}
    </>
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
export function PathControls({ studio, side = 'top' }: { studio: Studio; side?: 'top' | 'bottom' }) {
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

/** The words, face and setting of selected text. */
export function TextControls({ studio, layers, side = 'top' }: { studio: Studio; layers: StudioLayer[]; side?: 'top' | 'bottom' }) {
  const { actions, history } = studio;
  const text = layers[0].text!;
  const font = fontChoice(text.font);
  const live = (patch: Partial<StudioText>) => actions.setText(patch, { transient: true });
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
      <ToolPopover label='Text settings' icon={<SlidersHorizontal />} iconOnly side={side} onClose={history.commit}>
        <div className='flex w-[248px] flex-col gap-3'>
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
      </ToolPopover>
    </>
  );
}

/** The words themselves, open while the text is being typed. */
function TextEditButton({ studio, layer, side }: { studio: Studio; layer: StudioLayer; side: 'top' | 'bottom' }) {
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
export function PointEditBar({ studio, side = 'top' }: { studio: Studio; side?: 'top' | 'bottom' }) {
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

/** Points, sides, corners or weight, for the shapes that have them. */
function ShapeSettings({ studio, layer }: { studio: Studio; layer: StudioLayer }) {
  const shape = layer.shape!;
  const { kind } = shape;
  if (kind !== 'star' && kind !== 'polygon' && kind !== 'rect' && !isLinear(kind)) return null;
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
    <ToolPopover label='Shape' icon={<SlidersHorizontal />} iconOnly>
      <div className='flex w-[220px] flex-col gap-3.5'>
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
    </ToolPopover>
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
export function AlignControls({ studio }: { studio: Studio }) {
  const layers = studio.selectedLayers.filter((l) => !l.locked && !l.hidden);
  const scopes = alignScopes(studio.design, layers);
  const [picked, setPicked] = React.useState<AlignScope['id']>(scopes[0].id);
  const scope = scopes.find((s) => s.id === picked) ?? scopes[0];
  const { actions } = studio;
  return (
    <div className='flex w-[248px] flex-col gap-2.5'>
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
  side?: 'top' | 'bottom';
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

export function LayerMoreMenu({ studio, children, side = 'top' }: { studio: Studio; children: React.ReactNode; side?: 'top' | 'bottom' }) {
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

/** The floating bar above whatever is selected. */
export function ContextToolbar({
  studio,
  rect,
  container,
  onOpenLayout,
}: {
  studio: Studio;
  rect: Rect;
  container: { w: number; h: number };
  onOpenLayout: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.offsetWidth);
    const observer = new ResizeObserver(() => setWidth(el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { selectedLayers, fieldSelected, actions } = studio;
  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const anyOutline = selectedLayers.some((l) => l.outline);
  const allShapes = selectedLayers.length > 0 && selectedLayers.every((l) => l.shape);
  const allText = selectedLayers.length > 0 && selectedLayers.every((l) => l.text);
  const anyShape = selectedLayers.some((l) => l.shape);
  const repeat = selectionRepeat(studio);

  // Clear the rotate handle above the selection.
  const lift = 58 + (selectedLayers.some((l) => !l.locked && !l.hidden) && !studio.pathEdit ? 30 : 0);
  const above = rect.y - lift > 12;
  const top = above ? rect.y - lift : Math.min(rect.y + rect.h + 14, container.h - 60);
  const left = Math.min(Math.max(rect.x + rect.w / 2 - width / 2, 12), container.w - width - 12);

  let content: React.ReactNode = null;
  if (studio.pathEdit) {
    content = <PointEditBar studio={studio} />;
  } else if (selectedLayers.length > 0) {
    content = (
      <>
        {allShapes ? (
          <>
            {allText && (
              <>
                <TextControls studio={studio} layers={selectedLayers} />
                <ToolDivider />
              </>
            )}
            <ShapeControls studio={studio} layers={selectedLayers} />
            <PathControls studio={studio} />
          </>
        ) : (
          <>
            <div className='flex items-center gap-1.5 px-1.5'>
              {single && !studio.selectedGroup ? <LayerSwatches studio={studio} layer={single} /> : <SelectionSwatches studio={studio} />}
            </div>
            <ToolButton label='Match palette' onClick={actions.matchPalette}>
              <WandSparkles />
              <span>Match palette</span>
            </ToolButton>
          </>
        )}
        <ToolDivider />
        <ToolButton label='Flip' onClick={() => actions.flip('x')}>
          <FlipHorizontal />
        </ToolButton>
        <ToolButton label='Rotate' onClick={() => actions.rotateBy(90)}>
          <RotateQuarter />
        </ToolButton>
        <ToolPopover label='Align' icon={<AlignCentre />} iconOnly>
          <AlignControls studio={studio} />
        </ToolPopover>
        <ToolDivider />
        {repeat && (
          <ToolPopover label='Repeat' icon={<Repeat />} active={Boolean(repeat.repeat)}>
            <RepeatControls studio={studio} />
          </ToolPopover>
        )}
        {studio.selectedGroup ? (
          <ToolButton label='Ungroup (⇧⌘G)' onClick={actions.ungroup}>
            <Ungroup />
          </ToolButton>
        ) : (
          canGroup(studio) && (
            <ToolButton label='Group (⌘G)' onClick={actions.group}>
              <GroupIcon />
              <span>Group</span>
            </ToolButton>
          )
        )}
        {/* Shapes have their own stroke. */}
        {!anyShape && <OutlineButton studio={studio} active={anyOutline} />}
        <ToolDivider />
        <ToolButton label='Duplicate' onClick={() => actions.duplicateSelected()}>
          <Copy />
        </ToolButton>
        <ToolButton label='Delete' onClick={actions.deleteSelected}>
          <Trash2 />
        </ToolButton>
        <LayerMoreMenu studio={studio}>
          <ToolButton label='More'>
            <MoreHorizontal />
          </ToolButton>
        </LayerMoreMenu>
      </>
    );
  } else if (studio.selectedDivision) {
    const division = studio.selectedDivision;
    content = (
      <>
        <div className='flex items-center gap-1.5 px-1.5'>
          <FieldSwatches studio={studio} />
        </div>
        <ToolDivider />
        <ToolButton label='Edit' onClick={onOpenLayout}>
          <SquaresFour />
          <span>{division.name ?? DIVISIONS[division.kind].label}</span>
        </ToolButton>
        <ToolDivider />
        <ToolButton label='Duplicate' onClick={() => actions.duplicateDivision(division.id)}>
          <Copy />
        </ToolButton>
        <ToolButton label='Delete' onClick={() => actions.removeDivision(division.id)}>
          <Trash2 />
        </ToolButton>
      </>
    );
  } else if (fieldSelected) {
    content = (
      <>
        <div className='flex items-center gap-1.5 px-1.5'>
          <FieldSwatches studio={studio} />
        </div>
        <ToolDivider />
        <ToolButton label='Shuffle colours' onClick={actions.cycleFieldColors}>
          <SwapColors />
        </ToolButton>
        <ToolButton label='Field' onClick={onOpenLayout}>
          <SquaresFour />
          <span>Field</span>
        </ToolButton>
      </>
    );
  }
  if (!content) return null;

  return (
    <div
      ref={ref}
      // Its menus and popovers are portaled but still bubble here through React: keep them off the canvas.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      className='absolute z-20 flex items-center gap-0.5 rounded-[13px] bg-surface p-[5px] shadow-pop'
      style={{ left, top, visibility: width ? 'visible' : 'hidden' }}
    >
      {content}
    </div>
  );
}

function OutlineButton({ studio, active }: { studio: Studio; active: boolean }) {
  const single = studio.selectedLayers.length === 1 ? studio.selectedLayers[0] : null;
  const [open, setOpen] = React.useState(false);
  return (
    <div className='flex items-center'>
      <ToolButton label='Outline' active={active} onClick={studio.actions.toggleOutline} className={cn(active && single && 'rounded-r-none')}>
        <Outline />
        <span>Outline</span>
      </ToolButton>
      {active && single?.outline && (
        <Popover open={open} onOpenChange={(next) => (setOpen(next), !next && studio.history.commit())}>
          <PopoverTrigger asChild>
            <button
              type='button'
              aria-label='Outline settings'
              className='inline-flex h-8 cursor-pointer items-center gap-1 rounded-r-[9px] bg-main-soft pl-0.5 pr-1.5 text-main'
            >
              <span className='size-3.5 rounded-[4px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.2)]' style={{ background: single.outline.color }} />
              <ChevronDown className='size-3' />
            </button>
          </PopoverTrigger>
          <PopoverContent side='top' sideOffset={10} className='w-auto p-3.5' onOpenAutoFocus={(e) => e.preventDefault()}>
            <OutlineControls studio={studio} layer={single} />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
