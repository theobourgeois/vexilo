'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { openSignIn } from '@/lib/sign-in';
import { toast } from 'sonner';
import { postFlagDesign } from '@/actions/studio';
import WavingFlag from '@/components/WavingFlag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TagInput from '@/components/TagInput';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ClipboardIcon,
  Copy,
  SelectAll,
  FileImage,
  FileSvg,
  Fit,
  Flag,
  FlipHorizontal,
  GroupIcon,
  GoogleLogo,
  History,
  Link as LinkIcon,
  Loader2,
  Redo,
  Send,
  Shuffle,
  Trash2,
  Ungroup,
  Undo,
  WandSparkles,
  Wind,
  ZoomIn,
  ZoomOut,
  BringForward,
  SendBackward,
  Plus,
  ClipMask,
  ClippedBelow,
  FlagTriangleRight,
} from '@/components/icons';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { CUSTOM_TAG, MAKER_TAGS, REMIX_TAG } from '@/lib/studio-design';
import { blobToDataUrl, designToPng, designToSvg, download, encodeDoc, fileName } from './export';
import { FlagArt } from './FlagArt';
import { clipsBelow, clipTargets, samePart } from './clip';
import { fieldPartAt } from './divisions';
import { EXPORT_WIDTH, flagWidth, RATIOS, type StudioDoc } from './model';
import type { View } from './StudioCanvas';
import { canGroup } from './tools';
import { ToolButton } from './ui';
import type { Studio } from './use-studio';
import { canEditPoints } from './vector';

export type Remix = { id: string; name: string } | null;

// ───────────────────────── Title ─────────────────────────

export function FlagName({ studio, className }: { studio: Studio; className?: string }) {
  const [editing, setEditing] = React.useState(false);
  const name = studio.doc.name;
  if (editing)
    return (
      <input
        autoFocus
        defaultValue={name}
        maxLength={120}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => {
          if (e.target.value.trim()) studio.actions.setName(e.target.value.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={cn('min-w-0 rounded-[8px] bg-transparent px-1.5 font-semibold tracking-[-0.02em] outline-none ring-2 ring-ring', className)}
      />
    );
  return (
    <button
      type='button'
      onClick={() => setEditing(true)}
      className={cn('min-w-0 cursor-text truncate rounded-[8px] px-1.5 text-left font-semibold tracking-[-0.02em] hover:bg-foreground/[0.05]', className)}
    >
      {name}
    </button>
  );
}

export function RemixPill({ remix }: { remix: Remix }) {
  if (!remix) return null;
  return (
    <Link
      href={`/flag/${encodeURIComponent(remix.name)}`}
      className='inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-[rgb(225_120_50/0.13)] px-2.5 text-[12px] font-semibold text-[#b4541d] hover:brightness-110 dark:bg-[rgb(240_163_107/0.14)] dark:text-[#f0a36b]'
    >
      <Shuffle className='size-3' />
      <span className='max-w-[220px] truncate'>Remix of {remix.name.replace(/^the /, '')}</span>
    </Link>
  );
}

/** Back to the remixed flag (or a blank one). Only shown once something has changed. */
export function StartOver({ remix, onStartOver, className }: { remix: Remix; onStartOver?: () => void; className?: string }) {
  if (!onStartOver) return null;
  return (
    <button
      type='button'
      onClick={onStartOver}
      className={cn(
        'inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-subtle shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:bg-foreground/[0.05] hover:text-foreground',
        className,
      )}
    >
      <History className='size-3' />
      {remix ? 'Reset' : 'Start over'}
    </button>
  );
}

// ───────────────────────── Export ─────────────────────────

export function useExport(studio: Studio) {
  const { doc } = studio;
  return {
    async png() {
      const id = toast.loading('Rendering…');
      try {
        download(await designToPng(doc.design, EXPORT_WIDTH), `${fileName(doc.name)}.png`);
        toast.dismiss(id);
      } catch {
        toast.error('Could not export the flag', { id });
      }
    },
    async svg() {
      try {
        download(new Blob([await designToSvg(doc.design)], { type: 'image/svg+xml' }), `${fileName(doc.name)}.svg`);
      } catch {
        toast.error('Could not export the flag');
      }
    },
    async link() {
      const url = `${window.location.origin}/create#d=${await encodeDoc(doc)}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    },
    async copyImage() {
      try {
        const blob = await designToPng(doc.design, 1200);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success('Image copied');
      } catch {
        toast.error('Could not copy the image');
      }
    },
  };
}

export function ExportMenu({ studio, children, side = 'bottom' }: { studio: Studio; children: React.ReactNode; side?: 'top' | 'bottom' }) {
  const exporter = useExport(studio);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align='end' sideOffset={8} className='w-48'>
        <DropdownMenuItem onSelect={exporter.png}>
          <FileImage /> PNG
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={exporter.svg}>
          <FileSvg /> SVG
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={exporter.copyImage}>
          <ClipboardIcon /> Copy image
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={exporter.link}>
          <LinkIcon /> Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ───────────────────────── Post ─────────────────────────

export function PostDialog({ studio, remix, open, onOpenChange }: { studio: Studio; remix: Remix; open: boolean; onOpenChange: (open: boolean) => void }) {
  const session = useSession();
  const [title, setTitle] = React.useState(studio.doc.name);
  const [description, setDescription] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<null | { published: boolean }>(null);
  const makerTag = remix ? REMIX_TAG : CUSTOM_TAG;

  React.useEffect(() => { if (open) setTitle(studio.doc.name); }, [open, studio.doc.name]);

  async function submit() {
    const name = title.trim();
    if (!name) { toast.error('Give your flag a title.'); return; }
    studio.actions.setName(name);
    setBusy(true);
    try {
      const image = await blobToDataUrl(await designToPng(studio.design, 1800));
      const result = await postFlagDesign({
        name,
        description,
        tags,
        image,
        design: studio.design,
        remixOf: remix?.id ?? null,
      });
      if (result.success) setDone({ published: result.published });
      else toast.error(result.message);
    } catch {
      toast.error('Could not post the flag. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (onOpenChange(next), !next && setDone(null))}>
      <DialogContent className='w-[calc(100%-2rem)] max-w-[460px] sm:max-w-[460px] max-h-[calc(100dvh-2rem)] overflow-y-auto gap-5'>
        {done ? (
          <div className='flex flex-col items-center gap-3 py-4 text-center'>
            <FlagArt design={studio.design} className='studio-flag h-24 w-auto' style={{ aspectRatio: `${studio.design.ratio[1]} / ${studio.design.ratio[0]}` }} />
            <DialogTitle className='mt-2 text-[19px]'>{done.published ? 'Posted' : 'Sent for review'}</DialogTitle>
            <DialogDescription className='text-[13.5px] text-subtle'>
              {done.published ? `${studio.doc.name} is live.` : `${studio.doc.name} will appear once a moderator approves it.`}
            </DialogDescription>
            <Button variant='neutral' className='mt-2' onClick={() => onOpenChange(false)}>
              Back to editing
            </Button>
          </div>
        ) : (
          <>
            <div className='flex items-center gap-4'>
              <FlagArt design={studio.design} className='studio-flag h-14 w-auto shrink-0' style={{ aspectRatio: `${studio.design.ratio[1]} / ${studio.design.ratio[0]}` }} />
              <div className='min-w-0 flex-1'>
                <DialogTitle className='sr-only'>Post your flag</DialogTitle>
                <label htmlFor='post-flag-title' className='mb-1 block text-xs font-medium text-muted-foreground'>Title</label>
                <Input id='post-flag-title' value={title} maxLength={120} required disabled={busy} onChange={(event) => setTitle(event.target.value)} onBlur={() => { if (title.trim()) studio.actions.setName(title.trim()); }} className='text-[17px] font-semibold' />
                <DialogDescription className='sr-only'>Post this flag to Vexilo</DialogDescription>
                {remix && <p className='mt-0.5 truncate text-[13px] text-muted-foreground'>Remix of {remix.name}</p>}
              </div>
            </div>
            {session.status === 'authenticated' ? (
              <>
                <div className='space-y-1.5'>
                <label htmlFor='post-flag-description' className='text-[13px] font-medium'>Description</label>
                <textarea
                  id='post-flag-description'
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='Describe your flag…'
                  rows={3}
                  maxLength={2000}
                  className='vx-well w-full resize-none rounded-[12px] px-3.5 py-3 text-[14px] outline-none focus:ring-2 focus:ring-ring'
                />
                </div>
                <TagInput tags={tags} onTagsChange={(next) => setTags(next.filter((tag) => !MAKER_TAGS.includes(tag.toLowerCase())))} lockedTags={[makerTag]} maxTags={8} placeholder='Search or add tags…' />
                <Button onClick={submit} disabled={busy || !title.trim()} className='h-11'>
                  {busy ? <Loader2 className='animate-spin' /> : <Send />}
                  Post {remix ? 'remix' : 'flag'}
                </Button>
              </>
            ) : (
              <Button variant='neutral' className='h-11' onClick={() => openSignIn()}>
                <GoogleLogo />
                Sign in to post
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Dock & glance ─────────────────────────

const ratioKey = (r: [number, number]) => `${r[0]}:${r[1]}`;
const sameRatio = (a: [number, number], b: [number, number]) => Math.abs(a[1] / a[0] - b[1] / b[0]) < 1e-6;

/** Ratios real flags fly at, beyond the four in the dock. */
const MORE_RATIOS: { ratio: [number, number]; flag: string }[] = [
  { ratio: [10, 19], flag: 'United States' },
  { ratio: [5, 8], flag: 'Sweden' },
  { ratio: [8, 11], flag: 'Norway' },
  { ratio: [28, 37], flag: 'Denmark' },
  { ratio: [13, 15], flag: 'Belgium' },
  { ratio: [7, 10], flag: 'Brazil' },
  { ratio: [11, 28], flag: 'Qatar' },
  { ratio: [3, 4], flag: 'Bermuda' },
  { ratio: [4, 7], flag: 'Ivory Coast' },
];

export function RatioControl({ studio, className }: { studio: Studio; className?: string }) {
  const current = studio.design.ratio;
  const known = RATIOS.find((r) => sameRatio(r, current));
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={(next) => (setOpen(next), !next && studio.history.commit())}>
      <PopoverAnchor asChild>
        <div className='inline-flex'>
          <Segmented
            aria-label='Ratio'
            className={className}
            value={known ? ratioKey(known) : 'custom'}
            onChange={(value) => {
              const ratio = RATIOS.find((r) => ratioKey(r) === value);
              if (ratio) studio.actions.setRatio(ratio);
              else setOpen(true);
            }}
            options={[
              ...RATIOS.map((r) => ({ value: ratioKey(r), label: ratioKey(r) })),
              { value: 'custom', label: known ? 'Custom' : ratioKey(current) },
            ]}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent side='top' align='end' sideOffset={12} className='w-[264px] p-3'>
        <CustomRatio studio={studio} />
      </PopoverContent>
    </Popover>
  );
}

const trimNumber = (n: number) => String(Math.round(n * 1000) / 1000);

function CustomRatio({ studio }: { studio: Studio }) {
  const current = studio.design.ratio;
  const [text, setText] = React.useState(() => current.map(trimNumber) as [string, string]);
  const edit = (i: 0 | 1, value: string) => {
    const next: [string, string] = i === 0 ? [value, text[1]] : [text[0], value];
    setText(next);
    const ratio = next.map(Number) as [number, number];
    if (ratio.every((n) => n > 0 && n <= 20)) studio.actions.setRatio(ratio, { transient: true });
  };
  const input = (i: 0 | 1, label: string) => (
    <label className='flex min-w-0 flex-1 flex-col gap-1 text-[12px] text-subtle'>
      {label}
      <Input
        type='number'
        inputMode='decimal'
        min={0.1}
        max={20}
        step='any'
        value={text[i]}
        onChange={(e) => edit(i, e.target.value)}
        onBlur={studio.history.commit}
        className='h-8 tabular-nums'
      />
    </label>
  );
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-end gap-2'>
        {input(0, 'Height')}
        <span className='pb-1.5 text-subtle'>:</span>
        {input(1, 'Width')}
      </div>
      <div className='grid grid-cols-3 gap-1'>
        {MORE_RATIOS.map(({ ratio, flag }) => (
          <button
            key={flag}
            type='button'
            title={flag}
            onClick={() => (setText(ratio.map(trimNumber) as [string, string]), studio.actions.setRatio(ratio))}
            className={cn(
              'flex cursor-pointer flex-col items-center rounded-[8px] px-1 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              sameRatio(ratio, current) ? 'bg-main-soft text-foreground' : 'text-subtle hover:bg-foreground/[0.05] hover:text-foreground',
            )}
          >
            <span className='text-[13px] font-medium tabular-nums'>{ratioKey(ratio)}</span>
            <span className='w-full truncate text-center text-[11px] text-muted-foreground'>{flag}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ViewModeControl({ mode, setMode }: { mode: 'flat' | 'wave'; setMode: (mode: 'flat' | 'wave') => void }) {
  return (
    <Segmented
      aria-label='Preview'
      value={mode}
      onChange={setMode}
      options={[
        { value: 'flat', label: 'Flat', icon: <Flag /> },
        { value: 'wave', label: 'Wave', icon: <Wind /> },
      ]}
    />
  );
}

export function ZoomControl({ view, setView }: { view: View; setView: React.Dispatch<React.SetStateAction<View>> }) {
  const zoomTo = (zoom: number) => setView((v) => ({ zoom, panX: (v.panX * zoom) / v.zoom, panY: (v.panY * zoom) / v.zoom }));
  return (
    <div className='flex items-center'>
      <ToolButton label='Zoom out' onClick={() => zoomTo(Math.max(0.2, view.zoom / 1.25))}>
        <ZoomOut />
      </ToolButton>
      <button
        type='button'
        onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })}
        className='h-8 w-12 cursor-pointer rounded-[8px] text-[12.5px] font-medium tabular-nums text-subtle hover:bg-foreground/[0.06] hover:text-foreground'
      >
        {Math.round(view.zoom * 100)}%
      </button>
      <ToolButton label='Zoom in' onClick={() => zoomTo(Math.min(12, view.zoom * 1.25))}>
        <ZoomIn />
      </ToolButton>
      <ToolButton label='Fit' onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })}>
        <Fit />
      </ToolButton>
    </div>
  );
}

/** The flag at the sizes it's usually seen at. */
export function Glance({ studio, className, style }: { studio: Studio; className?: string; style?: React.CSSProperties }) {
  const aspect = `${studio.design.ratio[1]} / ${studio.design.ratio[0]}`;
  return (
    <div className={cn('flex items-end gap-3.5 rounded-[14px] bg-surface px-3.5 py-3 shadow-pop', className)} style={style}>
      <FlagArt design={studio.design} className='studio-flag block h-[34px] w-auto' style={{ aspectRatio: aspect }} />
      <FlagArt design={studio.design} className='studio-flag block h-[14px] w-auto' style={{ aspectRatio: aspect }} />
    </div>
  );
}

// ───────────────────────── Context menu ─────────────────────────

export function ContextMenu({
  studio,
  at,
  onClose,
}: {
  studio: Studio;
  at: { x: number; y: number; onLayer: boolean } | null;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  React.useLayoutEffect(() => {
    if (!at || !ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    setPos({ x: Math.min(at.x, window.innerWidth - w - 8), y: Math.min(at.y, window.innerHeight - h - 8) });
  }, [at]);
  React.useEffect(() => {
    if (!at) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof PointerEvent && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close);
      window.removeEventListener('blur', onClose);
    };
  }, [at, onClose]);
  if (!at) return null;
  const { actions, selectedLayers } = studio;
  const item = (label: string, icon: React.ReactNode, run: () => void, disabled = false) => (
    <button
      type='button'
      disabled={disabled}
      onClick={() => (run(), onClose())}
      className='flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium outline-none hover:bg-foreground/[0.06] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:text-subtle'
    >
      {icon}
      <span className='min-w-0 truncate'>{label}</span>
    </button>
  );
  const hasLayers = selectedLayers.length > 0;
  const single = selectedLayers.length === 1 && !selectedLayers[0].locked ? selectedLayers[0] : null;
  // Offers the field part under the layer's middle, the one it most likely belongs in.
  const under = single && fieldPartAt(studio.design, single.x * flagWidth(studio.design), single.y);
  const partTarget =
    single && under?.divisionId && under.target === 'fill'
      ? clipTargets(studio.design).find((t) => samePart(t.ref, { divisionId: under.divisionId!, part: under.part }))
      : null;
  const clip = single?.clip;
  return (
    <div
      ref={ref}
      role='menu'
      className='fixed z-50 w-52 rounded-[14px] bg-popover p-1.5 shadow-pop'
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {hasLayers && (
        <>
          {item('Copy', <Copy />, actions.copy)}
          {item('Duplicate', <Plus />, () => actions.duplicateSelected())}
          {item('Match palette', <WandSparkles />, actions.matchPalette)}
          {item('Flip', <FlipHorizontal />, () => actions.flip('x'))}
          {canGroup(studio) && item('Group', <GroupIcon />, actions.group)}
          {selectedLayers.some((l) => l.group) && item('Ungroup', <Ungroup />, actions.ungroup)}
          <div className='my-1 h-px bg-line' />
          {item('Bring to front', <BringForward />, () => actions.arrange('front'))}
          {item('Send to back', <SendBackward />, () => actions.arrange('back'))}
          {single && (
            <>
              <div className='my-1 h-px bg-line' />
              {partTarget &&
                !samePart(clip?.kind === 'part' ? clip : null, partTarget.ref) &&
                item(`Clip to ${partTarget.label}`, <ClipMask />, () => actions.setClip({ kind: 'part', ...partTarget.ref }))}
              {!clipsBelow(single) &&
                item('Clip to layer below', <ClippedBelow />, actions.toggleClipBelow, studio.design.layers[0]?.id === single.id)}
              {clip && item('Release clip', <ClipMask />, () => actions.setClip(null))}
              {canEditPoints(single) && item('Use as flag shape', <FlagTriangleRight />, () => actions.useAsFlagOutline(single.id))}
            </>
          )}
          <div className='my-1 h-px bg-line' />
          {item('Delete', <Trash2 />, actions.deleteSelected)}
        </>
      )}
      {!hasLayers && (
        <>
          {item('Paste', <ClipboardIcon />, actions.paste, !actions.canPaste())}
          {item('Select all', <SelectAll />, actions.selectAll, studio.design.layers.length === 0)}
          {item('Shuffle colours', <Shuffle />, actions.cycleFieldColors)}
        </>
      )}
    </div>
  );
}

// ───────────────────────── Wave preview ─────────────────────────

export function WavePreview({ doc, className }: { doc: StudioDoc; className?: string }) {
  const [texture, setTexture] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    let url: string | null = null;
    designToPng(doc.design, 1200).then((blob) => {
      if (!live) return;
      url = URL.createObjectURL(blob);
      setTexture(url);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.design]);
  if (!texture) return <div className={cn('grid place-items-center', className)}><Loader2 className='size-5 animate-spin text-muted-foreground' /></div>;
  return <WavingFlag src='' texture={texture} alt={doc.name} className={className} />;
}

export function UndoRedo({ studio }: { studio: Studio }) {
  return (
    <>
      <ToolButton label='Undo' side='bottom' onClick={studio.history.undo} disabled={!studio.history.canUndo}>
        <Undo />
      </ToolButton>
      <ToolButton label='Redo' side='bottom' onClick={studio.history.redo} disabled={!studio.history.canRedo}>
        <Redo />
      </ToolButton>
    </>
  );
}
