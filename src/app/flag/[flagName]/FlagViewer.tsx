'use client';

import React from 'react';
import { toast } from 'sonner';
import FlagImage from '@/components/FlagImage';
import WavingFlag from '@/components/WavingFlag';
import { Segmented } from '@/components/ui/segmented';
import { Button } from '@/components/ui/button';
import { ExternalLink, Link } from '@/components/icons';

type View = 'flat' | 'wave';

const WIND_LEVELS = [
  { value: '0.45', label: 'Light' },
  { value: '1', label: 'Breeze' },
  { value: '1.7', label: 'Strong' },
];

export default function FlagViewer({ image, name }: { image: string; name: string }) {
  const extension = image.split('?')[0].split('.').pop()?.toUpperCase();
  const [view, setView] = React.useState<View>('flat');
  const [wind, setWind] = React.useState('1');

  // ?view=wave opens the flag waving, so the mode can be shared.
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'wave') setView('wave');
  }, []);

  const changeView = (next: View) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'wave') url.searchParams.set('view', 'wave');
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
  };

  return (
    <div className='vx-tile flex flex-col overflow-hidden'>
      <div className='bg-stage relative h-[340px] sm:h-[440px]'>
        {view === 'flat' ? (
          <div className='flag-stage absolute inset-0 p-10 sm:p-14'>
            <FlagImage src={image} alt={name} maxHeight={320} area={560 * 320} eager />
          </div>
        ) : (
          <WavingFlag src={image} alt={name} wind={Number(wind)} className='absolute inset-0' />
        )}
        <Segmented
          aria-label='View'
          value={view}
          onChange={changeView}
          className='absolute right-3.5 top-3.5 z-10'
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'wave', label: 'Wave' },
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
        ) : (
          extension &&
          extension.length <= 4 && <span className='tabular-nums text-xs text-muted-foreground'>{extension}</span>
        )}
        <span className='flex-1' />
        <Button variant='neutral' asChild>
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
      </div>
    </div>
  );
}
