'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Fire } from '@/components/icons';
import { readStore } from '@/components/games/shared';
import { UnfurlArt } from '@/components/games/art';
import { localDate, puzzleNumber } from '@/lib/games/daily';
import { cn } from '@/lib/utils';
import { CardHeader } from './CardHeader';

type Results = {
  date: string;
  unfurl: { done: boolean; won: boolean; guesses: number };
  grid: { done: boolean; filled: number };
  streak: number;
  quizBest: number;
};

/** Today's results, from what each game saved in this browser. Null until mounted. */
function useResults(): Results | null {
  const [results, setResults] = React.useState<Results | null>(null);
  React.useEffect(() => {
    const date = localDate();
    const unfurl = readStore<{ guesses?: string[]; counted?: boolean }>(`vexilo-unfurl-${date}`, {});
    const stats = readStore<{ streak?: number; last?: string | null }>('vexilo-unfurl-stats', {});
    const grid = readStore<{ picks?: (string | null)[]; counted?: boolean }>(`vexilo-grid-${date}`, {});
    // A loss resets the streak to 0, so a counted game with a streak is a win.
    const wonToday = !!unfurl.counted && stats.last === date && (stats.streak ?? 0) > 0;
    setResults({
      date,
      unfurl: { done: !!unfurl.counted, won: wonToday, guesses: unfurl.guesses?.length ?? 0 },
      grid: { done: !!grid.counted, filled: grid.picks?.filter(Boolean).length ?? 0 },
      streak: stats.last === date || isYesterday(stats.last, date) ? (stats.streak ?? 0) : 0,
      quizBest: readStore<number>('vexilo-quiz-best', 0),
    });
  }, []);
  return results;
}

function isYesterday(last: string | null | undefined, today: string) {
  if (!last) return false;
  return Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`) === 24 * 60 * 60 * 1000;
}

const formatDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Unfurl, Vexigrid and the quiz, with how many people played today and, once mounted, this
 * browser's own results. The server renders it with the UTC date; the browser corrects it.
 */
export default function PuzzlesCard({
  played,
  serverDate,
  quizFlags,
  showStreak,
}: {
  played: { unfurl: number; grid: number };
  serverDate: string;
  quizFlags: string[];
  showStreak?: boolean;
}) {
  const results = useResults();
  const date = results?.date ?? serverDate;
  const number = puzzleNumber(date);

  const playedLine = (n: number) => (n > 0 ? `${n.toLocaleString()} played today` : 'New puzzle today');

  return (
    <div className='vx-tile flex flex-col overflow-hidden'>
      <CardHeader
        title='Daily puzzles'
        when={formatDay(date)}
        right={
          showStreak && results && results.streak > 1 ? (
            <span className='inline-flex items-center gap-1 text-[12.5px] font-medium text-subtle'>
              <Fire weight='fill' className='size-3.5 text-[#e8590c]' />
              {results.streak} days
            </span>
          ) : (
            <Link href='/play' className='inline-flex items-center gap-1 text-[12.5px] font-medium text-subtle hover:text-foreground'>
              All games <ArrowRight className='size-3' />
            </Link>
          )
        }
      />
      <div className='pb-2'>
        <PuzzleRow
          href='/play/unfurl'
          preview={<UnfurlArt className='h-7 shadow-[0_0_0_0.6px_rgb(28_29_31/0.35)]' />}
          name='Unfurl'
          number={number}
          sub={playedLine(played.unfurl)}
          result={
            results?.unfurl.done ? (
              results.unfurl.won ? (
                <>
                  <b className='font-semibold text-foreground'>Solved</b> in {results.unfurl.guesses}
                </>
              ) : (
                'Not solved'
              )
            ) : results ? (
              <PlayPill />
            ) : null
          }
        />
        <PuzzleRow
          href='/play/grid'
          preview={<MiniGrid />}
          name='Vexigrid'
          number={number}
          sub={playedLine(played.grid)}
          result={
            results?.grid.done ? (
              <>
                <b className='font-semibold text-foreground'>{results.grid.filled}</b> of 9
              </>
            ) : results ? (
              <PlayPill />
            ) : null
          }
        />
        <PuzzleRow
          href='/play/quiz'
          preview={<QuizPreview flags={quizFlags} />}
          name='Flag quiz'
          sub='Endless rounds'
          result={
            results && results.quizBest > 0 ? (
              <>
                Best streak <b className='font-semibold text-foreground'>{results.quizBest}</b>
              </>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function PuzzleRow({
  href,
  preview,
  name,
  number,
  sub,
  result,
}: {
  href: string;
  preview: React.ReactNode;
  name: string;
  number?: number;
  sub: string;
  result: React.ReactNode;
}) {
  return (
    <Link href={href} className='flex items-center gap-3.5 px-[18px] py-[9px] transition-colors hover:bg-foreground/[0.03] [&+&]:border-t [&+&]:border-line'>
      <span className='bg-stage relative grid h-11 w-[62px] shrink-0 place-items-center overflow-hidden rounded-[9px]'>{preview}</span>
      <span className='min-w-0 flex-1'>
        <span className='block text-[14px] font-medium'>
          {name}
          {number !== undefined && <span className='ml-1 font-normal tabular-nums text-muted-foreground'>#{number}</span>}
        </span>
        <span className='block truncate text-[12px] tabular-nums text-muted-foreground'>{sub}</span>
      </span>
      {result ? (
        <span className='whitespace-nowrap text-[12.5px] tabular-nums text-subtle'>{result}</span>
      ) : (
        <ChevronRight className='size-3.5 text-muted-foreground' />
      )}
    </Link>
  );
}

function PlayPill() {
  return <span className='inline-flex h-7 items-center rounded-lg bg-primary px-3 text-[12.5px] font-medium text-main-foreground'>Play</span>;
}

/** A 3×3 board with a few squares filled. */
function MiniGrid() {
  const filled = new Set([0, 2, 4, 8]);
  return (
    <span className='grid grid-cols-[repeat(3,13px)] auto-rows-[9px] gap-[2px]'>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={cn('rounded-[1.5px]', filled.has(i) ? 'bg-foreground/[0.38]' : 'bg-foreground/[0.09]')} />
      ))}
    </span>
  );
}

/** Three real flags, stacked like quiz cards. */
function QuizPreview({ flags }: { flags: string[] }) {
  const spots = ['left-0 top-0.5 -rotate-[8deg]', 'left-2 top-2 rotate-[2deg]', 'left-[15px] top-[13px] rotate-[9deg]'];
  return (
    <span className='relative h-[34px] w-[46px]'>
      {flags.slice(0, 3).map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=''
          className={cn('absolute h-5 w-[30px] rounded-[2px] bg-surface object-cover shadow-[0_0_0_1px_var(--line),0_3px_6px_rgb(0_0_0/0.12)]', spots[i])}
        />
      ))}
    </span>
  );
}
