'use client';

import React from 'react';
import Link from 'next/link';
import { Drawer } from 'vaul';
import { Button } from '@/components/ui/button';
import {
  AlignCentre,
  ArrowLeft,
  Copy,
  Emblems,
  FlipHorizontal,
  GroupIcon,
  Layers,
  MoreHorizontal,
  Opacity,
  Outline,
  Palette,
  Repeat,
  RotateQuarter,
  SquaresFour,
  SwapColors,
  Text,
  Trash2,
  Ungroup,
  WandSparkles,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { ExportMenu, FlagName, PostDialog, RatioControl, RemixPill, StartOver, UndoRedo, ViewModeControl, WavePreview, type Remix } from './chrome';
import type { StudioEmblem } from './model';
import { useImageImport } from './import-image';
import { ColoursPanel, EmblemsPanel, LayersPanel, LayoutPanel } from './panels';
import { StudioCanvas, type View } from './StudioCanvas';
import {
  AlignControls,
  FieldSwatches,
  LayerMoreMenu,
  LayerSwatches,
  OpacitySlider,
  OutlineControls,
  PathControls,
  PointEditBar,
  RepeatControls,
  SelectionSwatches,
  ShapeControls,
  TextControls,
  canGroup,
  selectionOpacity,
  selectionRepeat,
} from './tools';
import type { Panel } from './use-shortcuts';
import type { Studio } from './use-studio';

const TABS: { panel: Panel; label: string; icon: React.ReactNode }[] = [
  { panel: 'layout', label: 'Field', icon: <SquaresFour /> },
  { panel: 'emblems', label: 'Emblems', icon: <Emblems /> },
  { panel: 'colors', label: 'Colours', icon: <Palette /> },
  { panel: 'layers', label: 'Layers', icon: <Layers /> },
];

function Sheet({
  open,
  onOpenChange,
  title,
  children,
  tall,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className='fixed inset-0 z-40 bg-black/25' />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[22px] bg-surface pb-[max(env(safe-area-inset-bottom),12px)] shadow-pop outline-none',
            tall ? 'h-[72dvh]' : 'max-h-[72dvh]',
          )}
        >
          <div className='mx-auto mb-1 mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-foreground/15' />
          <Drawer.Title className='px-5 pb-3 pt-1 text-[16px] font-semibold tracking-[-0.01em]'>{title}</Drawer.Title>
          <Drawer.Description className='sr-only'>{title}</Drawer.Description>
          <div className='flex min-h-0 flex-1 flex-col overflow-y-auto px-4'>{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Action({ label, active, children, ...props }: { label: string; active?: boolean } & React.ComponentProps<'button'>) {
  return (
    <button
      type='button'
      className={cn(
        'flex h-[52px] min-w-[56px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] px-1.5 text-[10.5px] font-medium text-subtle active:bg-foreground/[0.06] [&_svg]:size-5',
        active && 'bg-main-soft text-main',
      )}
      {...props}
    >
      {children}
      {label}
    </button>
  );
}

export function MobileStudio({
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
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [tool, setTool] = React.useState<'repeat' | 'outline' | 'align' | 'opacity' | null>(null);
  const [view, setView] = React.useState<View>({ zoom: 1, panX: 0, panY: 0 });
  const [mode, setMode] = React.useState<'flat' | 'wave'>('flat');
  const [posting, setPosting] = React.useState(false);
  const { selectedLayers, fieldSelected, actions } = studio;
  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const allShapes = selectedLayers.length > 0 && selectedLayers.every((l) => l.shape);
  const allText = selectedLayers.length > 0 && selectedLayers.every((l) => l.text);
  const repeat = selectionRepeat(studio);
  const importImages = useImageImport(studio);

  return (
    <div className='fixed inset-0 z-30 flex flex-col bg-stage'>
      <header className='flex h-14 shrink-0 items-center gap-1 border-b border-line bg-background/90 px-2 backdrop-blur-xl'>
        <Link href='/' aria-label='Back' className='grid size-10 shrink-0 place-items-center rounded-[10px] text-subtle active:bg-foreground/[0.06]'>
          <ArrowLeft className='size-5' />
        </Link>
        <FlagName studio={studio} className='h-9 min-w-0 flex-1 text-[16px]' />
        <UndoRedo studio={studio} />
        <ExportMenu studio={studio}>
          <button type='button' aria-label='Export' className='grid size-10 shrink-0 place-items-center rounded-[10px] text-subtle active:bg-foreground/[0.06]'>
            <MoreHorizontal className='size-5' />
          </button>
        </ExportMenu>
        <Button size='sm' className='ml-1' onClick={() => setPosting(true)}>
          Post
        </Button>
      </header>

      <main className='relative min-h-0 flex-1'>
        <div className='studio-dots pointer-events-none absolute inset-0 opacity-70' />
        {mode === 'flat' ? (
          <StudioCanvas studio={studio} view={view} setView={setView} insets={{ top: 44, right: 12, bottom: 20, left: 12 }} touch />
        ) : (
          <WavePreview doc={studio.doc} className='absolute inset-0' />
        )}
        {(remix || onStartOver) && (
          <div className='absolute left-3 top-3 flex items-center gap-1.5'>
            <RemixPill remix={remix} />
            <StartOver remix={remix} onStartOver={onStartOver} className='bg-surface' />
          </div>
        )}
      </main>

      {/* What you can do to the selection */}
      {(selectedLayers.length > 0 || fieldSelected) && mode === 'flat' && (
        <div className='shrink-0 border-t border-line bg-surface'>
          <div className='flex items-center gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]'>
            {studio.pathEdit ? (
              <div className='flex shrink-0 items-center px-1'>
                <PointEditBar studio={studio} />
              </div>
            ) : selectedLayers.length > 0 ? (
              <>
                {allShapes ? (
                  <div className='flex shrink-0 items-center px-1'>
                    {allText && <TextControls studio={studio} layers={selectedLayers} />}
                    <ShapeControls studio={studio} layers={selectedLayers} />
                    <PathControls studio={studio} />
                  </div>
                ) : (
                  <>
                    <div className='flex shrink-0 items-center gap-1.5 px-2'>
                      {single && !studio.selectedGroup ? (
                        <LayerSwatches studio={studio} layer={single} size={30} />
                      ) : (
                        <SelectionSwatches studio={studio} size={30} />
                      )}
                    </div>
                    <Action label='Match' onClick={actions.matchPalette}>
                      <WandSparkles />
                    </Action>
                  </>
                )}
                <Action label='Flip' onClick={() => actions.flip('x')}>
                  <FlipHorizontal />
                </Action>
                <Action label='Rotate' onClick={() => actions.rotateBy(90)}>
                  <RotateQuarter />
                </Action>
                <Action label='Align' onClick={() => setTool('align')}>
                  <AlignCentre />
                </Action>
                {repeat && (
                  <Action label='Repeat' active={Boolean(repeat.repeat)} onClick={() => setTool('repeat')}>
                    <Repeat />
                  </Action>
                )}
                {studio.selectedGroup ? (
                  <Action label='Ungroup' onClick={actions.ungroup}>
                    <Ungroup />
                  </Action>
                ) : (
                  canGroup(studio) && (
                    <Action label='Group' onClick={actions.group}>
                      <GroupIcon />
                    </Action>
                  )
                )}
                {!selectedLayers.some((l) => l.shape) && <Action
                  label='Outline'
                  active={selectedLayers.some((l) => l.outline)}
                  onClick={() => {
                    if (single?.outline) setTool('outline');
                    else actions.toggleOutline();
                  }}
                >
                  <Outline />
                </Action>}
                <Action label='Opacity' active={selectionOpacity(studio) < 1} onClick={() => setTool('opacity')}>
                  <Opacity />
                </Action>
                <Action label='Duplicate' onClick={() => actions.duplicateSelected()}>
                  <Copy />
                </Action>
                <Action label='Delete' onClick={actions.deleteSelected}>
                  <Trash2 />
                </Action>
                <LayerMoreMenu studio={studio}>
                  <Action label='More'>
                    <MoreHorizontal />
                  </Action>
                </LayerMoreMenu>
              </>
            ) : (
              <>
                <div className='flex shrink-0 items-center gap-1.5 px-2'>
                  <FieldSwatches studio={studio} size={30} />
                </div>
                <Action label='Shuffle' onClick={actions.cycleFieldColors}>
                  <SwapColors />
                </Action>
                <Action label='Field' onClick={() => setPanel('layout')}>
                  <SquaresFour />
                </Action>
              </>
            )}
          </div>
        </div>
      )}

      <nav className='flex shrink-0 justify-around border-t border-line bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5'>
        {TABS.map(({ panel: id, label, icon }) => (
          <React.Fragment key={id}>
            <Action label={label} active={panel === id} onClick={() => setPanel(id)}>
              {icon}
            </Action>
            {id === 'emblems' && (
              <Action
                label='Text'
                onClick={() => {
                  setMode('flat');
                  void actions.addText({ x: studio.W / 2, y: 0.5 + 0.12 * 0.35 });
                }}
              >
                <Text />
              </Action>
            )}
          </React.Fragment>
        ))}
      </nav>

      <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)} title={TABS.find((t) => t.panel === panel)?.label ?? ''} tall={panel === 'emblems'}>
        {panel === 'emblems' && (
          <EmblemsPanel
            emblems={emblems}
            columns={4}
            onAdd={(emblem) => {
              actions.addEmblem(emblem);
              setMode('flat');
              setPanel(null);
            }}
            onUpload={(files) => {
              setPanel(null);
              setMode('flat');
              void importImages(files);
            }}
          />
        )}
        {panel === 'layout' && (
          <div className='flex flex-col gap-4 pb-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <RatioControl studio={studio} />
              <ViewModeControl mode={mode} setMode={setMode} />
            </div>
            <LayoutPanel studio={studio} columns={4} />
          </div>
        )}
        {panel === 'colors' && (
          <div className='pb-4'>
            <ColoursPanel studio={studio} />
          </div>
        )}
        {panel === 'layers' && (
          <div className='pb-4'>
            <LayersPanel studio={studio} onOpenField={() => setPanel('layout')} />
          </div>
        )}
      </Sheet>

      <Sheet
        open={tool === 'align' || tool === 'opacity' ? selectedLayers.length > 0 : tool === 'repeat' ? Boolean(repeat) : tool !== null && Boolean(single)}
        onOpenChange={(open) => !open && (studio.history.commit(), setTool(null))}
        title={tool === 'repeat' ? 'Repeat' : tool === 'align' ? 'Align' : tool === 'opacity' ? `Opacity · ${Math.round(selectionOpacity(studio) * 100)}%` : 'Outline'}
      >
        <div className='flex justify-center pb-5'>
          {tool === 'align' && <AlignControls studio={studio} />}
          {tool === 'opacity' && (
            <div className='w-[248px] py-2'>
              <OpacitySlider studio={studio} />
            </div>
          )}
          {repeat && tool === 'repeat' && <RepeatControls studio={studio} />}
          {single && tool === 'outline' && (
            <div className='flex w-[248px] flex-col gap-3'>
              <OutlineControls studio={studio} layer={single} />
              <Button variant='neutral' onClick={() => (actions.toggleOutline(), setTool(null))}>
                Remove outline
              </Button>
            </div>
          )}
        </div>
      </Sheet>

      <PostDialog studio={studio} remix={remix} open={posting} onOpenChange={setPosting} />
    </div>
  );
}
