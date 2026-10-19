'use client';

import React from 'react';
import { toast } from 'sonner';
import CustomFlag from '@/components/CustomFlag';
import FlagImage from '@/components/FlagImage';
import WavingFlag from '@/components/WavingFlag';
import { Segmented } from '@/components/ui/segmented';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Link, RotateCw } from '@/components/icons';
import type { PaletteColor } from '@/lib/flag-palette';

type View = 'flat' | 'wave' | 'custom';

const VIEWS: View[] = ['flat', 'wave', 'custom'];

const WIND_LEVELS = [
  { value: '0.45', label: 'Light' },
  { value: '1', label: 'Breeze' },
  { value: '1.7', label: 'Strong' },
];

export default function FlagViewer({
  image,
  name,
  palette: palettePromise,
}: {
  image: string;
  name: string;
  /** The flag's colours, which stream in after the page. */
  palette: Promise<PaletteColor[]>;
}) {
  const extension = image.split('?')[0].split('.').pop()?.toUpperCase();
  const [view, setView] = React.useState<View>('flat');
  const [wind, setWind] = React.useState('1');
  const [palette, setPalette] = React.useState<PaletteColor[]>([]);
  const [colors, setColors] = React.useState<string[]>([]);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    palettePromise.then(
      (next) => {
        if (cancelled) return;
        setPalette(next);
        setColors(next.map((color) => color.hex));
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [palettePromise]);

  // ?view=wave or ?view=custom opens the flag in that mode, so the mode can be shared.
  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('view') as View | null;
    if (requested && requested !== 'flat' && VIEWS.includes(requested)) setView(requested);
  }, []);

  const changeView = (next: View) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'flat') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.replaceState(null, '', url);
  };

  const canCustomize = palette.length > 0;
  const customView = view === 'custom' && canCustomize;
  const edited = colors.some((color, index) => color.toUpperCase() !== palette[index]?.hex.toUpperCase());

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'flag'}-custom.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <div className='vx-tile flex flex-col overflow-hidden'>
      <div className='bg-stage relative h-[340px] sm:h-[440px]'>
        {view === 'wave' ? (
          <WavingFlag src={image} alt={name} wind={Number(wind)} className='absolute inset-0' />
        ) : customView ? (
          <div className='flag-stage absolute inset-0 p-10 sm:p-14'>
            <CustomFlag
              src={image}
              alt={name}
              palette={palette.map((color) => color.hex)}
              colors={colors}
              canvasRef={canvasRef}
              maxHeight={320}
              area={560 * 320}
            />
          </div>
        ) : (
          <div className='flag-stage absolute inset-0 p-10 sm:p-14'>
            <FlagImage src={image} alt={name} maxHeight={320} area={560 * 320} eager />
          </div>
        )}
        <Segmented
          aria-label='View'
          value={view === 'custom' && !canCustomize ? 'flat' : view}
          onChange={changeView}
          className='absolute right-3.5 top-3.5 z-10'
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'wave', label: 'Wave' },
            ...(canCustomize ? [{ value: 'custom' as const, label: 'Custom' }] : []),
          ]}
        />
      </div>
      <div className='flex flex-wrap items-center gap-2 border-t border-line py-3 pl-[18px] pr-3'>
        {view === 'wave' ? (
          <>
            <span className='text-[13px] text-muted-foreground'>Wind</span>
            <Segmented aria-label='Wind' value={wind} onChange={setWind} options={WIND_LEVELS} />
            <span className='hidden text-[13px] text-muted-foreground sm:inline'>· drag to turn</span>
          </>
        ) : customView ? (
          <>
            <span className='mr-1 text-[13px] text-muted-foreground'>Colours</span>
            {palette.map((color, index) => (
              <label
                key={color.hex}
                title={`${color.name} · ${colors[index].toUpperCase()}`}
                className='relative size-8 shrink-0 cursor-pointer rounded-[9px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none transition-transform hover:scale-105 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring'
                style={{ background: colors[index] }}
              >
                <span className='sr-only'>Change {color.name}</span>
                <input
                  type='color'
                  value={colors[index].toLowerCase()}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setColors((current) => current.map((c, i) => (i === index ? value : c)));
                  }}
                  className='absolute inset-0 size-full cursor-pointer opacity-0'
                />
              </label>
            ))}
            {edited && (
              <Button
                variant='ghost'
                size='icon-sm'
                title='Reset colours'
                onClick={() => setColors(palette.map((color) => color.hex))}
              >
                <RotateCw />
              </Button>
            )}
          </>
        ) : (
          extension &&
          extension.length <= 4 && <span className='tabular-nums text-xs text-muted-foreground'>{extension}</span>
        )}
        <span className='flex-1' />
        {customView ? (
          <Button variant='neutral' onClick={download}>
            <Download />
            Download
          </Button>
        ) : (
          <Button variant='neutral' asChild>
            <a href={image} target='_blank' rel='noopener noreferrer'>
              <ExternalLink />
              Full size
            </a>
          </Button>
        )}
        <Button
          variant='neutral'
          size='icon-sm'
          title='Copy link'
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href);
            toast.success('Link copied');
          }}
        >
          <Link />
        </Button>
      </div>
    </div>
  );
}
