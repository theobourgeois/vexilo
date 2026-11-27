'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from '@/components/icons';

const VIEW = 280; // crop square, in CSS px
const MAX_ZOOM = 4;
const OUTPUT_SIZE = 512;

type Crop = { zoom: number; x: number; y: number }; // x/y: image's top-left inside the square

/** Keep the image covering the whole square. */
function clamp(crop: Crop, width: number, height: number): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, crop.zoom));
  const scale = (VIEW / Math.min(width, height)) * zoom;
  return {
    zoom,
    x: Math.min(0, Math.max(VIEW - width * scale, crop.x)),
    y: Math.min(0, Math.max(VIEW - height * scale, crop.y)),
  };
}

/** Change zoom while keeping the point under (px, py) in place. */
function zoomAround(crop: Crop, zoom: number, px: number, py: number, width: number, height: number) {
  const base = VIEW / Math.min(width, height);
  const from = base * crop.zoom;
  const to = base * Math.min(MAX_ZOOM, Math.max(1, zoom));
  return clamp(
    { zoom, x: px - ((px - crop.x) / from) * to, y: py - ((py - crop.y) / from) * to },
    width,
    height,
  );
}

/**
 * Lets someone choose the square part of a picture to use as their avatar:
 * drag (or arrow keys) to move, slider, wheel or pinch to zoom.
 */
export function AvatarCropper({
  file,
  onCancel,
  onCrop,
}: {
  file: File | null;
  onCancel: () => void;
  onCrop: (image: Blob) => Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    setSize(null);
    setFailed(false);
    if (!file) return setUrl(null);
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const onLoad = () => {
    const image = imageRef.current!;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const scale = VIEW / Math.min(width, height);
    setSize({ width, height });
    setCrop({ zoom: 1, x: (VIEW - width * scale) / 2, y: (VIEW - height * scale) / 2 });
  };

  const update = (next: (crop: Crop) => Crop) => {
    if (size) setCrop((crop) => clamp(next(crop), size.width, size.height));
  };
  const zoomTo = (zoom: number, px = VIEW / 2, py = VIEW / 2) => {
    if (size) setCrop((crop) => zoomAround(crop, zoom, px, py, size.width, size.height));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(e.pointerId);
    if (!last || !size) return;
    const others = [...pointers.current].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (others.length === 0) {
      update((crop) => ({ ...crop, x: crop.x + e.clientX - last.x, y: crop.y + e.clientY - last.y }));
      return;
    }
    // Pinch: zoom by how much the distance between the two fingers changed.
    const other = others[0];
    const before = Math.hypot(last.x - other.x, last.y - other.y);
    const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
    if (before < 1) return;
    const box = e.currentTarget.getBoundingClientRect();
    const midX = (e.clientX + other.x) / 2 - box.left;
    const midY = (e.clientY + other.y) / 2 - box.top;
    setCrop((crop) => zoomAround(crop, crop.zoom * (after / before), midX, midY, size.width, size.height));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    zoomTo(crop.zoom * Math.exp(-e.deltaY / 400), e.clientX - box.left, e.clientY - box.top);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (e.key === '+' || e.key === '=') zoomTo(crop.zoom * 1.1);
    else if (e.key === '-') zoomTo(crop.zoom / 1.1);
    else if (moves[e.key]) {
      const [dx, dy] = moves[e.key];
      update((crop) => ({ ...crop, x: crop.x + dx, y: crop.y + dy }));
    } else return;
    e.preventDefault();
  };

  const save = async () => {
    const image = imageRef.current;
    if (!image || !size) return;
    const scale = (VIEW / Math.min(size.width, size.height)) * crop.zoom;
    const side = VIEW / scale; // in source pixels
    const out = Math.round(Math.min(side, OUTPUT_SIZE));
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, -crop.x / scale, -crop.y / scale, side, side, 0, 0, out, out);
    setBusy(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), 'image/webp', 0.9),
      );
      await onCrop(blob);
    } finally {
      setBusy(false);
    }
  };

  const scale = size ? (VIEW / Math.min(size.width, size.height)) * crop.zoom : 0;

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className='sm:max-w-[360px]'>
        <DialogHeader>
          <DialogTitle className='text-[17px] font-semibold tracking-[-0.02em]'>Crop your picture</DialogTitle>
          <DialogDescription>Drag to move it, and zoom to fit.</DialogDescription>
        </DialogHeader>
        <div className='mx-auto flex flex-col items-center gap-4'>
          <div
            role='application'
            aria-label='Picture crop. Arrow keys move it, plus and minus zoom.'
            tabIndex={0}
            className='relative cursor-grab touch-none select-none overflow-hidden rounded-[12px] bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing'
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
          >
            {url && !failed && (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL, drawn to a canvas
              <img
                ref={imageRef}
                src={url}
                alt=''
                draggable={false}
                onLoad={onLoad}
                onError={() => setFailed(true)}
                className='pointer-events-none absolute left-0 top-0 max-w-none origin-top-left'
                style={
                  size
                    ? { width: size.width * scale, height: size.height * scale, transform: `translate(${crop.x}px, ${crop.y}px)` }
                    : { visibility: 'hidden' }
                }
              />
            )}
            {failed && (
              <p className='absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground'>
                That image couldn&apos;t be read.
              </p>
            )}
            {/* Avatars are round: dim what falls outside the circle. */}
            <div
              aria-hidden
              className='pointer-events-none absolute inset-0 rounded-full'
              style={{ boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)', outline: '2px solid rgb(255 255 255 / 0.85)' }}
            />
          </div>
          <input
            type='range'
            aria-label='Zoom'
            className='studio-range w-full'
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            disabled={!size}
            onChange={(e) => zoomTo(Number(e.target.value))}
          />
        </div>
        <DialogFooter>
          <Button variant='neutral' onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!size || busy}>
            {busy && <Loader2 className='animate-spin' />}
            Save picture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
