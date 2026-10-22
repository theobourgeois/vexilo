'use client';

import React from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Download, Emblems, Layers, Palette, Send, SquaresFour, X } from '@/components/icons';
import type { StudioDesign } from '@/lib/studio-design';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ExportMenu,
  FlagName,
  Glance,
  PostDialog,
  RatioControl,
  RemixPill,
  StartOver,
  UndoRedo,
  useExport,
  ViewModeControl,
  WavePreview,
  ZoomControl,
  type Remix,
} from './chrome';
import type { FieldPart } from './divisions';
import { DEFAULT_DRAW, ToolOptions, ToolPicker, type DrawSettings, type ToolKind } from './draw';
import { documentColors, pixelSize, type StudioEmblem } from './model';
import { useImageImport } from './import-image';
import { ColoursPanel, EmblemsPanel, LayersPanel, LayoutPanel, PanelTitle } from './panels';
import { StudioCanvas, type View } from './StudioCanvas';
import { Inspector } from './inspector';
import { ColorPicker, ToolDivider } from './ui';
import { useShortcuts, type Panel } from './use-shortcuts';
import type { Studio } from './use-studio';

const INSPECTOR = 280;

const RAIL: { panel: Panel; label: string; icon: React.ReactNode }[] = [
  { panel: 'layout', label: 'Field', icon: <SquaresFour /> },
  { panel: 'emblems', label: 'Emblems', icon: <Emblems /> },
  { panel: 'colors', label: 'Colours', icon: <Palette /> },
  { panel: 'layers', label: 'Layers', icon: <Layers /> },
];

type ColorTarget = { x: number; y: number; kind: 'field'; part: FieldPart } | { x: number; y: number; kind: 'layer'; id: string };

export function DesktopStudio({
  studio,
  emblems,
  remix,
  onStartOver,
}: {
  studio: Studio;
  emblems: StudioEmblem[];
  remix: Remix;
  onStartOver?: () => void;
}) {
  const [panel, setPanel] = React.useState<Panel | null>('emblems');
  const [view, setView] = React.useState<View>({ zoom: 1, panX: 0, panY: 0 });
  const [mode, setMode] = React.useState<'flat' | 'wave'>('flat');
  const [menu, setMenu] = React.useState<{ x: number; y: number; onLayer: boolean } | null>(null);
  const [posting, setPosting] = React.useState(false);
  const [colorTarget, setColorTarget] = React.useState<ColorTarget | null>(null);
  const [draw, setDraw] = React.useState<DrawSettings>(DEFAULT_DRAW);
  const scaleRef = React.useRef(1);
  const exporter = useExport(studio);
  const importImages = useImageImport(studio);
  const setTool = (tool: ToolKind) => {
    setDraw((d) => ({ ...d, tool }));
    if (tool !== 'select') setMode('flat');
  };

  useShortcuts(studio, {
    setView,
    onExport: exporter.png,
    onPasteFiles: (files) => importImages(files),
    setPanel: (next) => setPanel((current) => (current === next ? null : next)),
    tool: draw.tool,
    setTool,
    // One screen pixel, in whole export pixels: a single pixel up close.
    nudgeStep: () => {
      const px = pixelSize(studio.W);
      return Math.max(1, Math.round(1 / (px * scaleRef.current))) * px;
    },
    enabled: !posting,
  });

  const drawerOpen = panel !== null;
  const left = drawerOpen ? 436 : 104;
  // The inspector's width and the gap either side of it.
  const right = INSPECTOR + 40;
  const insets = { top: 132, right, bottom: 92, left };

  const addEmblem = (emblem: StudioEmblem, at?: { x: number; y: number }) => {
    studio.actions.addEmblem(emblem, at);
    setMode('flat');
  };

  return (
    <div className='relative h-[calc(100dvh-64px)] overflow-hidden bg-stage'>
      <div className='studio-dots pointer-events-none absolute inset-0 opacity-70' />

      {mode === 'flat' ? (
        <StudioCanvas
          studio={studio}
          view={view}
          setView={setView}
          insets={insets}
          onContextMenu={setMenu}
          draw={draw}
          onShapeDrawn={() => setTool('select')}
          scaleRef={scaleRef}
          onDoubleClickField={(part, at) => setColorTarget({ ...at, kind: 'field', part })}
          onDoubleClickLayer={(id, at) => setColorTarget({ ...at, kind: 'layer', id })}
          onDropFiles={(files, at) => importImages(files, at)}
          onDropEmblem={(id, at) => {
            const emblem = emblems.find((e) => e.id === id);
            if (emblem) addEmblem(emblem, at);
          }}
        />
      ) : (
        <div className='absolute' style={{ left, right: insets.right, top: insets.top - 40, bottom: insets.bottom }}>
          <WavePreview doc={studio.doc} className='absolute inset-0' />
        </div>
      )}

      {/* Rail */}
      <nav className='vx-tile absolute left-5 top-5 flex flex-col gap-1 p-1.5'>
        {RAIL.map(({ panel: id, label, icon }) => (
          <button
            key={id}
            type='button'
            onClick={() => setPanel(panel === id ? null : id)}
            className={cn(
              'flex h-[54px] w-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-[11px] text-[10.5px] font-medium text-subtle transition-colors hover:bg-foreground/[0.05] hover:text-foreground [&_svg]:size-[19px]',
              panel === id && 'bg-main-soft text-main hover:bg-main-soft hover:text-main',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      {/* Drawer */}
      {drawerOpen && (
        <aside className='vx-tile absolute bottom-5 left-[100px] top-5 flex w-[316px] flex-col gap-3.5 p-4 shadow-pop'>
          <div className='flex items-center justify-between'>
            <PanelTitle>{RAIL.find((r) => r.panel === panel)?.label}</PanelTitle>
            <button type='button' aria-label='Close' onClick={() => setPanel(null)} className='grid size-7 cursor-pointer place-items-center rounded-[8px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'>
              <X className='size-4' />
            </button>
          </div>
          {panel === 'emblems' && <EmblemsPanel emblems={emblems} onAdd={(emblem) => addEmblem(emblem)} onUpload={(files) => importImages(files)} />}
          {panel === 'layout' && <LayoutPanel studio={studio} />}
          {panel === 'colors' && <ColoursPanel studio={studio} />}
          {panel === 'layers' && <LayersPanel studio={studio} onOpenField={() => setPanel('layout')} />}
        </aside>
      )}

      {/* Toolbar */}
      <header className='absolute right-5 top-5 flex h-[52px] items-center gap-1.5 rounded-[14px] bg-surface py-1.5 pl-2 pr-1.5 shadow-pop' style={{ left }}>
        <FlagName studio={studio} className='h-9 max-w-[360px] text-[18px]' />
        <RemixPill remix={remix} />
        <StartOver remix={remix} onStartOver={onStartOver} />
        <span className='min-w-2 flex-1' />
        <ToolPicker tool={draw.tool} onChange={setTool} />
        <ToolDivider />
        <UndoRedo studio={studio} />
        <ExportMenu studio={studio}>
          <Button variant='neutral' size='sm'>
            <Download />
            Export
          </Button>
        </ExportMenu>
        <Button size='sm' onClick={() => setPosting(true)}>
          <Send />
          Post
        </Button>
      </header>

      {/* Centred over the canvas, clear of the drawer and inspector. */}
      <div className='pointer-events-none absolute top-[84px] flex justify-center' style={{ left, right }}>
        <ToolOptions studio={studio} draw={draw} onChange={(patch) => setDraw((d) => ({ ...d, ...patch }))} className='pointer-events-auto' />
      </div>

      <Inspector studio={studio} onOpenLayout={() => setPanel('layout')} className='absolute bottom-[84px] right-5 top-[84px]' style={{ width: INSPECTOR }} />

      {/* Glance and dock */}
      <Glance studio={studio} className='absolute bottom-5' style={{ left }} />
      <div className='absolute bottom-5 right-5 flex items-center gap-2 rounded-[14px] bg-surface p-[7px] shadow-pop'>
        <RatioControl studio={studio} />
        <ViewModeControl mode={mode} setMode={setMode} />
        <ZoomControl view={view} setView={setView} />
      </div>

      <ContextMenu studio={studio} at={menu} onClose={() => setMenu(null)} />
      <CanvasColorPicker studio={studio} target={colorTarget} onClose={() => setColorTarget(null)} />
      <PostDialog studio={studio} remix={remix} open={posting} onOpenChange={setPosting} />
    </div>
  );
}

/** The colour picker that double-clicking a stripe or emblem opens, right where you clicked. */
function CanvasColorPicker({ studio, target, onClose }: { studio: Studio; target: ColorTarget | null; onClose: () => void }) {
  const layer = target?.kind === 'layer' ? studio.design.layers.find((l) => l.id === target.id) : null;
  const value = target?.kind === 'field' ? fieldPartColor(studio.design, target.part) : layer?.colors[0];
  if (!target || !value) return null;
  return (
    <Popover open onOpenChange={(open) => (!open && (studio.history.commit(), onClose()))}>
      <PopoverAnchor asChild>
        <span className='fixed size-px' style={{ left: target.x, top: target.y }} />
      </PopoverAnchor>
      <PopoverContent side='right' align='start' sideOffset={12} className='w-auto p-3' onOpenAutoFocus={(e) => e.preventDefault()}>
        <ColorPicker
          value={value}
          documentColors={documentColors(studio.design)}
          onChange={(color) =>
            target.kind === 'field'
              ? studio.actions.setFieldPartColor(target.part, color, { transient: true })
              : studio.actions.setLayerColor(target.id, 0, color, { transient: true })
          }
          onCommit={studio.history.commit}
        />
      </PopoverContent>
    </Popover>
  );
}

/** The colour a field part shows now, which may have changed since it was picked. */
function fieldPartColor(design: StudioDesign, part: FieldPart) {
  const field = design.field;
  if (field.kind !== 'stack') return undefined;
  const division = field.divisions.find((d) => d.id === part.divisionId);
  if (!division) return part.divisionId ? undefined : field.color;
  return part.target === 'fimbriation' ? division.fimbriation?.color : division.colors[part.slot];
}
