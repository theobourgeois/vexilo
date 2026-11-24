'use client';

import React from 'react';
import { toast } from 'sonner';
import FlagImage from '@/components/FlagImage';
import WavingFlag from '@/components/WavingFlag';
import { Segmented } from '@/components/ui/segmented';
import { Button } from '@/components/ui/button';
import { ExternalLink, Link } from '@/components/icons';
import { cn } from '@/lib/utils';

type View = 'flat' | 'wave';

const VIEWS: View[] = ['flat', 'wave'];

const WIND_LEVELS = [
  { value: '0.45', label: 'Light' },
  { value: '1', label: 'Breeze' },
  { value: '1.7', label: 'Strong' },
];

export default function FlagViewer({
  image,
  name,
  variant = 'tile',
}: {
  image: string;
  name: string;
  /** `tile` is a card of its own; `band` sits on the flag page's coloured header. */
  variant?: 'tile' | 'band';
}) {
  const extension = image.split('?')[0].split('.').pop()?.toUpperCase();
  const [view, setView] = React.useState<View>('flat');
  const [wind, setWind] = React.useState('1');

  // ?view=wave opens the flag waving, so the mode can be shared.
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

  // Band: the flag sits straight on the page header, a little bigger, with its controls underneath.
  const band = variant === 'band';

  const stage =
    view === 'wave' ? (
      <WavingFlag src={image} alt={name} wind={Number(wind)} className='absolute inset-0' />
    ) : (
      <div className={cn('flag-stage absolute inset-0', !band && 'p-10 sm:p-14')}>
        <FlagImage
          src={image}
          alt={name}
          maxHeight={band ? 345 : 320}
          area={band ? 560 * 330 : 560 * 320}
          eager
        />
      </div>
    );

  const viewPicker = (
    <Segmented
      aria-label='View'
      value={view}
      onChange={changeView}
      className={band ? undefined : 'absolute right-3.5 top-3.5 z-10'}
      options={[
        { value: 'flat', label: 'Flat' },
        { value: 'wave', label: 'Wave' },
      ]}
    />
  );

  const viewControls =
    view === 'wave' ? (
      <>
        <span className='text-[13px] text-muted-foreground'>Wind</span>
        <Segmented aria-label='Wind' value={wind} onChange={setWind} options={WIND_LEVELS} />
        <span className='hidden text-[13px] text-muted-foreground sm:inline'>· drag to turn</span>
      </>
    ) : band ? null : (
      extension &&
      extension.length <= 4 && <span className='tabular-nums text-xs text-muted-foreground'>{extension}</span>
    );

  const fileActions = (
    <>
      <Button variant='neutral' size={band ? 'sm' : 'default'} asChild>
        <a href={image} target='_blank' rel='noopener noreferrer'>
          <ExternalLink />
          Full size
        </a>
      </Button>
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
    </>
  );

  if (band) {
    return (
      <div>
        <div className='relative h-[230px] sm:h-[345px]'>{stage}</div>
        <div className='mt-4 flex flex-wrap items-center gap-2'>
          {viewPicker}
          {viewControls}
          <span className='flex-1' />
          {fileActions}
        </div>
      </div>
    );
  }

  return (
    <div className='vx-tile flex flex-col overflow-hidden'>
      <div className='bg-stage relative h-[340px] sm:h-[440px]'>
        {stage}
        {viewPicker}
      </div>
      <div className='flex flex-wrap items-center gap-2 border-t border-line py-3 pl-[18px] pr-3'>
        {viewControls}
        <span className='flex-1' />
        {fileActions}
      </div>
    </div>
  );
}
