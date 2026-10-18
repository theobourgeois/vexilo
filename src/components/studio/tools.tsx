'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  AlignBottom,
  AlignCentre,
  AlignLeft,
  AlignMiddle,
  AlignRight,
  AlignTop,
  ArcIcon,
  BringForward,
  DistributeHorizontal,
  DistributeVertical,
  FitInto,
  Proportions,
  ColumnsIcon,
  Copy,
  Eye,
  EyeSlash,
  FlipHorizontal,
  FlipVertical,
  GridIcon,
  Lock,
  MoreHorizontal,
  Outline,
  Repeat,
  RingIcon,
  RotateQuarter,
  RowsIcon,
  SendBackward,
  SquaresFour,
  SwapColors,
  Trash2,
  Unlock,
  WandSparkles,
  X,
  ChevronDown,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import type { StudioLayer, StudioRepeat } from '@/lib/studio-design';
import { documentColors } from './model';
import { alignScopes, type AlignScope } from './regions';
import { ColorPicker, Slider, Swatch, ToolButton, ToolDivider } from './ui';
import type { Rect } from './StudioCanvas';
import type { AlignEdge, Studio } from './use-studio';

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

export function FieldSwatches({ studio, size, side }: { studio: Studio; size?: number; side?: 'top' | 'bottom' }) {
  return (
    <>
      {studio.design.field.colors.map((color, i) => (
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

export function RepeatControls({ studio, layer }: { studio: Studio; layer: StudioLayer }) {
  const repeat = layer.repeat;
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
  children,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  iconOnly?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolButton label={label} active={active || open}>
          {icon}
          {!iconOnly && <span>{label}</span>}
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent side='top' sideOffset={10} className='w-auto p-3.5' onOpenAutoFocus={(e) => e.preventDefault()}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

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
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.resetLayerColors(selectedLayers.map((l) => l.id))}>
          <SwapColors /> Original colours
        </DropdownMenuItem>
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

  // Clear the rotate handle above the selection.
  const lift = 58 + (selectedLayers.some((l) => !l.locked && !l.hidden) ? 30 : 0);
  const above = rect.y - lift > 12;
  const top = above ? rect.y - lift : Math.min(rect.y + rect.h + 14, container.h - 60);
  const left = Math.min(Math.max(rect.x + rect.w / 2 - width / 2, 12), container.w - width - 12);

  let content: React.ReactNode = null;
  if (selectedLayers.length > 0) {
    content = (
      <>
        {single && (
          <div className='flex items-center gap-1.5 px-1.5'>
            <LayerSwatches studio={studio} layer={single} />
          </div>
        )}
        <ToolButton label='Match palette' onClick={actions.matchPalette}>
          <WandSparkles />
          <span>Match palette</span>
        </ToolButton>
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
        {single ? (
          <ToolPopover label='Repeat' icon={<Repeat />} active={Boolean(single.repeat)}>
            <RepeatControls studio={studio} layer={single} />
          </ToolPopover>
        ) : null}
        <OutlineButton studio={studio} active={anyOutline} />
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
        <ToolButton label='Layout' onClick={onOpenLayout}>
          <SquaresFour />
          <span>Layout</span>
        </ToolButton>
      </>
    );
  }
  if (!content) return null;

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
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
