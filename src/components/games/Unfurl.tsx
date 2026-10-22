'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getUnfurlPuzzle, recordUnfurlResult } from '@/actions/games';
import FlagImage from '@/components/FlagImage';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, CheckCircle, Fire, Share, Target, Trophy, XCircle } from '@/components/icons';
import { CountryPicker } from '@/components/games/CountryPicker';
import { Countdown, Stat, playerId, readStore, shareResult, writeStore } from '@/components/games/shared';
import { localDate, previousDate, seededRandom } from '@/lib/games/daily';
import { COLOR_NAMES, COLOR_SWATCHES, COUNTRY_BY_ID, countryColors, type Country } from '@/lib/games/pool';
import { cn } from '@/lib/utils';

const MAX_GUESSES = 6;
const COLS = 6;
const ROWS = 4;
const TILES = COLS * ROWS;
/** Tiles showing before each guess; whatever's left is revealed at the end. */
const SHOWN = [3, 5, 8, 12, 16, 20];

type Saved = { guesses: string[]; counted: boolean; recorded?: boolean };
type Stats = { played: number; won: number; streak: number; best: number; last: string | null; dist: number[] };

const savedKey = (date: string) => `vexilo-unfurl-${date}`;
const STATS_KEY = 'vexilo-unfurl-stats';
const EMPTY_STATS: Stats = { played: 0, won: 0, streak: 0, best: 0, last: null, dist: [0, 0, 0, 0, 0, 0] };

const sameRegion = (a: Country, b: Country) => a.regions.some((r) => b.regions.includes(r));

type Stage = { url: string; ratio: number; order: number[] };

/**
 * Reveals the plainest tiles first: each tile is scored by how many colours it holds and how busy
 * it is, so an emblem stays hidden until late and a field of one colour shows early.
 */
function useStage(date: string | undefined, seed: number) {
  const [stage, setStage] = React.useState<Stage | null>(null);
  React.useEffect(() => {
    if (!date) return;
    let cancelled = false;
    // Loaded by date rather than by file, so the answer's name isn't in the image URL.
    const url = `/api/games/unfurl?date=${date}`;
    const random = seededRandom(seed);
    const fallback = (ratio: number) => ({ url, ratio, order: Array.from({ length: TILES }, (_, i) => i).sort(() => random() - 0.5) });
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const ratio = img.naturalWidth / img.naturalHeight || 1.5;
      const w = 120;
      const h = Math.max(ROWS * 4, Math.round(w / ratio));
      const ctx = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true });
      if (!ctx) return setStage(fallback(ratio));
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const bucket = (p: number) => (data[p + 3] < 128 ? -1 : ((data[p] >> 5) << 6) | ((data[p + 1] >> 5) << 3) | (data[p + 2] >> 5));
      const colours = Array.from({ length: TILES }, () => new Map<number, number>());
      const edges = new Array(TILES).fill(0);
      const sizes = new Array(TILES).fill(0);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const tile = Math.min(COLS - 1, Math.floor((x / w) * COLS)) + Math.min(ROWS - 1, Math.floor((y / h) * ROWS)) * COLS;
          const p = (y * w + x) * 4;
          const b = bucket(p);
          colours[tile].set(b, (colours[tile].get(b) ?? 0) + 1);
          sizes[tile]++;
          if (x + 1 < w && bucket(p + 4) !== b) edges[tile]++;
          if (y + 1 < h && bucket(p + w * 4) !== b) edges[tile]++;
        }
      }
      const score = colours.map((counts, tile) => {
        const distinct = [...counts.values()].filter((n) => n / sizes[tile] > 0.03).length;
        return distinct + (edges[tile] / sizes[tile]) * 6 + random() * 0.6;
      });
      const order = Array.from({ length: TILES }, (_, i) => i).sort((a, b) => score[a] - score[b]);
      setStage({ url, ratio, order });
    };
    img.onerror = () => !cancelled && setStage(fallback(1.5));
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [date, seed]);
  return stage;
}

function Swatch({ code, match }: { code: string; match: boolean }) {
  return (
    <span
      title={`${COLOR_NAMES[code]}${match ? ' — in today’s flag' : ' — not in today’s flag'}`}
      className={cn(
        'grid size-[18px] place-items-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.18)]',
        !match && 'opacity-25',
      )}
      style={{ background: COLOR_SWATCHES[code] }}
    />
  );
}

export default function Unfurl() {
  const [date, setDate] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<Saved>({ guesses: [], counted: false });
  const [stats, setStats] = React.useState<Stats>(EMPTY_STATS);

  React.useEffect(() => {
    const today = localDate();
    setDate(today);
    setSaved(readStore(savedKey(today), { guesses: [], counted: false }));
    setStats(readStore(STATS_KEY, EMPTY_STATS));
  }, []);

  const { data: puzzle, isError } = useQuery({
    queryKey: ['unfurl', date],
    queryFn: () => getUnfurlPuzzle(date!),
    enabled: !!date,
    staleTime: Infinity,
  });

  const answer = puzzle ? COUNTRY_BY_ID.get(puzzle.answerId) : undefined;
  const stage = useStage(puzzle?.date, puzzle?.number ?? 0);
  const guesses = saved.guesses.map((id) => COUNTRY_BY_ID.get(id)).filter((c): c is Country => !!c);
  const won = !!answer && guesses.some((g) => g.id === answer.id);
  const done = won || guesses.length >= MAX_GUESSES;
  const shown = done ? TILES : SHOWN[guesses.length];
  const answerColors = React.useMemo(() => new Set(answer ? countryColors(answer) : []), [answer]);

  // Count the game in the stats once, the moment it ends.
  React.useEffect(() => {
    if (!date || !done || saved.counted) return;
    const next = { ...readStore(STATS_KEY, EMPTY_STATS) };
    next.played++;
    if (won) {
      next.won++;
      next.streak = next.last === previousDate(date) ? next.streak + 1 : 1;
      next.best = Math.max(next.best, next.streak);
      next.dist = next.dist.map((n, i) => (i === guesses.length - 1 ? n + 1 : n));
    } else {
      next.streak = 0;
    }
    next.last = date;
    writeStore(STATS_KEY, next);
    setStats(next);
    const counted = { ...saved, counted: true };
    writeStore(savedKey(date), counted);
    setSaved(counted);
  }, [date, done, won, saved, guesses.length]);

  // Save the result for everyone's stats; a failed save is tried again on the next visit.
  React.useEffect(() => {
    if (!date || !done || !saved.counted || saved.recorded) return;
    let cancelled = false;
    recordUnfurlResult(date, saved.guesses, playerId())
      .then(() => {
        if (cancelled) return;
        const next = { ...saved, recorded: true };
        writeStore(savedKey(date), next);
        setSaved(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [date, done, saved]);

  const guess = (country: Country) => {
    if (!date || done) return;
    const next = { ...saved, guesses: [...saved.guesses, country.id] };
    writeStore(savedKey(date), next);
    setSaved(next);
  };

  const share = () => {
    if (!puzzle || !answer) return;
    const rows = guesses.map((g) => (g.id === answer.id ? '🟩' : sameRegion(g, answer) ? '🟨' : '🟥')).join('');
    shareResult(`Vexilo Unfurl #${puzzle.number} · ${won ? guesses.length : 'X'}/${MAX_GUESSES}\n${rows}\nhttps://vexilo.org/play/unfurl`);
  };

  const used = React.useMemo(() => new Set(saved.guesses), [saved.guesses]);
  const maxDist = Math.max(1, ...stats.dist);

  return (
    <div className='mx-auto max-w-[760px] pb-16'>
      <div className='flex flex-wrap items-end gap-3 pb-4 pt-7'>
        <div className='min-w-0 flex-1'>
          <h1 className='flex items-baseline gap-2.5 text-[22px] font-semibold tracking-[-0.03em]'>
            Unfurl
            {puzzle && <span className='tabular-nums text-sm font-normal tracking-normal text-muted-foreground'>#{puzzle.number}</span>}
          </h1>
          <p className='mt-0.5 text-[13px] text-muted-foreground'>
            Name the country. Each wrong guess reveals more of its flag and which colours you got right.
          </p>
        </div>
        <div className='flex gap-2'>
          <Stat icon={<Fire weight='fill' />} label='Streak' value={stats.streak} hot={stats.streak > 0} />
          <Stat icon={<Trophy />} label='Best' value={stats.best} />
        </div>
      </div>

      {/* Not overflow-hidden: the guess results float below the section. */}
      <section className='vx-tile'>
        <div className='bg-stage relative h-[280px] rounded-t-[16px] [container-type:size] sm:h-[340px]'>
          <span className='vx-label absolute left-[18px] top-4'>
            {done ? (won ? `Solved in ${guesses.length}` : 'Out of guesses') : `Guess ${guesses.length + 1} of ${MAX_GUESSES}`}
          </span>
          <span className='vx-label absolute right-[18px] top-4 tabular-nums'>
            {shown}/{TILES} tiles
          </span>
          <div className='flag-stage absolute inset-x-8 bottom-8 top-12'>
            <div
              className='flag-img relative'
              data-ready='true'
              style={
                {
                  '--r': stage?.ratio ?? 1.5,
                  '--hmax': '250px',
                  '--area': 380 * 250,
                } as React.CSSProperties
              }
            >
              {stage && (
                // eslint-disable-next-line @next/next/no-img-element -- drawn under the tiles at its natural proportions
                <img src={stage.url} alt={done ? answer?.name : 'Today’s mystery flag'} draggable={false} className='absolute inset-0 size-full select-none' />
              )}
              <div className='absolute inset-0 grid grid-cols-6 grid-rows-4'>
                {Array.from({ length: TILES }, (_, tile) => {
                  const rank = stage ? stage.order.indexOf(tile) : TILES;
                  return (
                    <span
                      key={tile}
                      className={cn(
                        'bg-raised shadow-[inset_0_0_0_0.5px_var(--line)] transition-opacity duration-500',
                        rank < shown && 'opacity-0',
                      )}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className='px-6 pb-6 pt-[22px]'>
          {isError ? (
            <p className='text-[13.5px] text-subtle'>Today’s flag couldn’t be loaded. Try again in a moment.</p>
          ) : done && answer ? (
            <div className='flex flex-wrap items-center gap-3'>
              <div className='min-w-0 flex-1'>
                <p className={cn('text-[13.5px] font-semibold', won ? 'text-good' : 'text-bad')}>
                  {won ? (guesses.length === 1 ? 'First try.' : `Got it in ${guesses.length}.`) : 'Not this time.'}
                </p>
                <Link href={answer.href} className='text-[26px] font-semibold leading-tight tracking-[-0.04em] hover:underline hover:underline-offset-4'>
                  {answer.name}
                </Link>
              </div>
              <Button variant='ghost' asChild>
                <Link href={answer.href}>
                  View flag
                  <ArrowUpRight />
                </Link>
              </Button>
              <Button onClick={share}>
                <Share />
                Share
              </Button>
            </div>
          ) : (
            <CountryPicker onPick={guess} used={used} autoFocus disabled={!puzzle} floating placeholder='Which country is it?' />
          )}

          {guesses.length > 0 && (
            <ol className='mt-4 flex flex-col gap-1.5'>
              {guesses.map((g, i) => {
                const right = g.id === answer?.id;
                const near = !!answer && sameRegion(g, answer);
                return (
                  <li key={g.id} className='vx-well flex h-12 items-center gap-3 rounded-[12px] pl-3 pr-3.5'>
                    <span className='w-4 tabular-nums text-xs text-muted-foreground'>{i + 1}</span>
                    <span className='flag-stage h-7 w-10 shrink-0'>
                      <FlagImage src={g.image} alt='' maxHeight={26} area={38 * 25} />
                    </span>
                    <span className='min-w-0 flex-1 truncate text-[14.5px] font-semibold'>{g.name}</span>
                    {!right && (
                      <>
                        <span className='hidden gap-1 sm:flex'>
                          {countryColors(g).map((code) => (
                            <Swatch key={code} code={code} match={answerColors.has(code)} />
                          ))}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11.5px] font-medium',
                            near ? 'bg-good-soft text-good' : 'bg-foreground/[0.06] text-muted-foreground',
                          )}
                        >
                          {near ? 'Same continent' : 'Elsewhere'}
                        </span>
                      </>
                    )}
                    {right ? <CheckCircle className='size-[18px] text-good' /> : <XCircle className='size-[18px] text-bad' />}
                  </li>
                );
              })}
            </ol>
          )}
          {guesses.length > 0 && !done && (
            <p className='mt-3 text-xs text-muted-foreground'>Faded colours aren’t in today’s flag.</p>
          )}
        </div>
      </section>

      {done && (
        <section className='vx-tile mt-4 p-6'>
          <div className='flex flex-wrap items-baseline justify-between gap-2'>
            <h2 className='text-base font-semibold tracking-[-0.02em]'>Your record</h2>
            <Countdown label='Next flag' />
          </div>
          <div className='mt-3 flex flex-wrap gap-2'>
            <Stat icon={<Target />} label='Played' value={stats.played} />
            <Stat icon={<CheckCircle />} label='Won' value={`${stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%`} />
            <Stat icon={<Fire weight='fill' />} label='Streak' value={stats.streak} hot={stats.streak > 0} />
            <Stat icon={<Trophy />} label='Best' value={stats.best} />
          </div>
          <div className='mt-5 flex flex-col gap-1.5'>
            {stats.dist.map((n, i) => (
              <div key={i} className='flex items-center gap-2.5 text-xs tabular-nums'>
                <span className='w-3 text-muted-foreground'>{i + 1}</span>
                <span
                  className={cn(
                    'flex h-5 min-w-6 items-center justify-end rounded-[6px] px-1.5 font-semibold',
                    won && i === guesses.length - 1 ? 'bg-primary text-main-foreground' : 'bg-foreground/[0.08]',
                  )}
                  style={{ width: `${(n / maxDist) * 100}%` }}
                >
                  {n}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
