'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle } from '@/components/icons';
import { GridArt, UnfurlArt } from '@/components/games/art';
import { useDoneToday } from '@/components/games/shared';
import { localDate, puzzleNumber } from '@/lib/games/daily';
import { cn } from '@/lib/utils';

function QuizArt() {
  return (
    <div className='grid w-[180px] grid-cols-2 gap-1.5'>
      {[false, true, false, false].map((right, i) => (
        <span
          key={i}
          className={cn(
            'flex h-[30px] items-center gap-1.5 rounded-[8px] px-2',
            right ? 'bg-good-soft shadow-[inset_0_0_0_1.5px_var(--good)]' : 'vx-key',
          )}
        >
          <span className='h-2 flex-1 rounded-full bg-foreground/[0.1]' />
        </span>
      ))}
    </div>
  );
}

const GAMES = [
  {
    href: '/play/unfurl',
    title: 'Unfurl',
    daily: 'vexilo-unfurl',
    blurb: 'One country a day. Its flag starts mostly hidden, and every wrong guess uncovers more of it.',
    art: <UnfurlArt />,
  },
  {
    href: '/play/grid',
    title: 'Vexigrid',
    daily: 'vexilo-grid',
    blurb: 'Nine squares, nine guesses. Find a country for each row and column, and go for the answers nobody else thought of.',
    art: <GridArt />,
  },
  {
    href: '/play/quiz',
    title: 'Flag quiz',
    blurb: 'Endless rounds of naming flags, or finding them. Countries, US states, territories and more.',
    art: <QuizArt />,
  },
];

function GameCard({ game }: { game: (typeof GAMES)[number] }) {
  const done = useDoneToday(game.daily);
  const [number, setNumber] = React.useState<number | null>(null);
  React.useEffect(() => setNumber(puzzleNumber(localDate())), []);
  return (
    <Link
      href={game.href}
      className='vx-tile group flex flex-col overflow-hidden transition-[box-shadow] duration-300 hover:shadow-tile-hover'
    >
      <div className='bg-stage grid h-[190px] place-items-center border-b border-line'>{game.art}</div>
      <div className='flex flex-1 flex-col p-5'>
        <span className='vx-label flex items-center gap-1.5'>
          {game.daily ? (
            <>
              Daily{number !== null && <span className='tabular-nums'> · #{number}</span>}
              {done && (
                <span className='ml-auto inline-flex items-center gap-1 text-good'>
                  <CheckCircle className='size-3.5' /> Done today
                </span>
              )}
            </>
          ) : (
            'Any time'
          )}
        </span>
        <h2 className='mt-1.5 text-[19px] font-semibold tracking-[-0.03em]'>{game.title}</h2>
        <p className='mt-1 text-[13.5px] text-subtle'>{game.blurb}</p>
        <span className='mt-auto inline-flex items-center gap-1.5 pt-4 text-[13.5px] font-medium text-main'>
          {done ? 'See your result' : 'Play'}
          <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-0.5' />
        </span>
      </div>
    </Link>
  );
}

export default function PlayPage() {
  return (
    <div className='mx-auto max-w-[1100px] px-4 pb-16 md:px-8'>
      <div className='pb-[18px] pt-7'>
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Play</h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>
          Flag games built on real flags only: countries, states and territories. No remixes.
        </p>
      </div>
      <div className='grid gap-4 md:grid-cols-3'>
        {GAMES.map((game) => (
          <GameCard key={game.href} game={game} />
        ))}
      </div>
    </div>
  );
}
