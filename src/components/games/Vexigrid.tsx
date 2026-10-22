'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getGridPuzzle, getGridResults, recordGridResult, submitGridGuess } from '@/actions/games';
import FlagImage from '@/components/FlagImage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ArrowUpRight, Flag as FlagIcon, Share, Sparkles, Target, Trophy, Users } from '@/components/icons';
import { CountryPicker } from '@/components/games/CountryPicker';
import { Countdown, Stat, playerId, readStore, shareResult, writeStore } from '@/components/games/shared';
import { localDate } from '@/lib/games/daily';
import { CRITERIA, cellAnswers, type Criterion, type GridSpec } from '@/lib/games/grid';
import { COLOR_SWATCHES, COUNTRY_BY_ID, type Country } from '@/lib/games/pool';
import { cn } from '@/lib/utils';

const GUESSES = 9;

type Saved = {
  picks: (string | null)[];
  /** How many players picked the same answer when it was played, as a percentage. */
  percents: (number | null)[];
  left: number;
  counted: boolean;
  recorded?: boolean;
};
type Stats = { played: number; perfect: number; best: number | null };

const savedKey = (date: string) => `vexilo-grid-${date}`;
const STATS_KEY = 'vexilo-grid-stats';
const fresh = (): Saved => ({ picks: Array(9).fill(null), percents: Array(9).fill(null), left: GUESSES, counted: false });
const EMPTY_STATS: Stats = { played: 0, perfect: 0, best: null };

function CriterionLabel({ criterion, className }: { criterion: Criterion; className?: string }) {
  return (
    <span className={cn('flex items-center justify-center gap-1.5 text-center text-[12.5px] font-semibold leading-tight sm:text-[13.5px]', className)}>
      {criterion.swatch && (
        <span
          className={cn(
            'size-3 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.2)]',
            criterion.id.startsWith('no:') && 'bg-[linear-gradient(135deg,transparent_45%,var(--bad)_45%,var(--bad)_55%,transparent_55%)]',
          )}
          style={{ backgroundColor: COLOR_SWATCHES[criterion.swatch] }}
        />
      )}
      <span>{criterion.label}</span>
    </span>
  );
}

export default function Vexigrid() {
  const [date, setDate] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<Saved>(fresh);
  const [stats, setStats] = React.useState<Stats>(EMPTY_STATS);
  // The square being played. It outlives the dialog's open state so the content stays put while it animates closed.
  const [open, setOpen] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [miss, setMiss] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const today = localDate();
    setDate(today);
    setSaved(readStore(savedKey(today), fresh()));
    setStats(readStore(STATS_KEY, EMPTY_STATS));
  }, []);

  const { data: puzzle, isError } = useQuery({
    queryKey: ['grid', date],
    queryFn: () => getGridPuzzle(date!),
    enabled: !!date,
    staleTime: Infinity,
  });
  const grid: GridSpec | undefined = puzzle?.grid;

  const filled = saved.picks.filter(Boolean).length;
  const done = !!grid && (filled === 9 || saved.left <= 0);

  const { data: results } = useQuery({
    queryKey: ['grid-results', date],
    queryFn: () => getGridResults(date!),
    enabled: !!date && done,
  });

  // Rarity: the share of players who picked the same answer, summed; an empty cell costs 100.
  const percents = saved.picks.map((id, cell) => (id ? (results?.cells[cell].percents[id] ?? saved.percents[cell] ?? 100) : null));
  const rarity = percents.reduce<number>((sum, p) => sum + (p ?? 100), 0);

  const update = React.useCallback(
    (next: Saved) => {
      if (date) writeStore(savedKey(date), next);
      setSaved(next);
    },
    [date],
  );

  React.useEffect(() => {
    if (!date || !done || saved.counted) return;
    const next = { ...readStore(STATS_KEY, EMPTY_STATS) };
    next.played++;
    if (filled === 9) next.perfect++;
    if (filled === 9) next.best = next.best === null ? rarity : Math.min(next.best, rarity);
    writeStore(STATS_KEY, next);
    setStats(next);
    update({ ...saved, counted: true });
  }, [date, done, saved, filled, rarity, update]);

  // Save the result for everyone's stats; a failed save is tried again on the next visit.
  React.useEffect(() => {
    if (!date || !done || !saved.counted || saved.recorded) return;
    let cancelled = false;
    recordGridResult(date, saved.picks, saved.left, playerId())
      .then(() => !cancelled && update({ ...saved, recorded: true }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [date, done, saved, update]);

  const used = React.useMemo(() => new Set(saved.picks.filter((id): id is string => !!id)), [saved.picks]);

  const guess = async (country: Country) => {
    if (open === null || !date || done || busy) return;
    setBusy(true);
    setMiss(null);
    try {
      const result = await submitGridGuess(date, open, country.id, playerId());
      const next = { ...saved, left: saved.left - 1, picks: [...saved.picks], percents: [...saved.percents] };
      if (result.correct) {
        next.picks[open] = country.id;
        next.percents[open] = result.percent;
        setDialogOpen(false);
      } else {
        setMiss(`${country.name} doesn’t fit this square.`);
      }
      update(next);
    } catch {
      setMiss('That guess didn’t go through. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const share = () => {
    if (!puzzle) return;
    const rows = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (saved.picks[r * 3 + c] ? '🟩' : '⬜')).join('')).join('\n');
    shareResult(`Vexigrid #${puzzle.number} · ${filled}/9\n${rows}\nRarity ${rarity}\nhttps://vexilo.org/play/grid`);
  };

  const openCell = open !== null && grid ? ([CRITERIA.get(grid.rows[Math.floor(open / 3)])!, CRITERIA.get(grid.cols[open % 3])!] as const) : null;
  const openAnswers = React.useMemo(() => {
    if (open === null || !grid || !done) return [];
    const percentsInCell = results?.cells[open].percents ?? {};
    return cellAnswers(grid, open).sort((a, b) => (percentsInCell[b.id] ?? 0) - (percentsInCell[a.id] ?? 0) || a.name.localeCompare(b.name));
  }, [open, grid, done, results]);

  return (
    <div className='mx-auto max-w-[760px] pb-16'>
      <div className='flex flex-wrap items-end gap-3 pb-4 pt-7'>
        <div className='min-w-0 flex-1'>
          <h1 className='flex items-baseline gap-2.5 text-[22px] font-semibold tracking-[-0.03em]'>
            Vexigrid
            {puzzle && <span className='tabular-nums text-sm font-normal tracking-normal text-muted-foreground'>#{puzzle.number}</span>}
          </h1>
          <p className='mt-0.5 text-[13px] text-muted-foreground'>
            Fill each square with a country whose flag fits its row and column. Nine guesses, no repeats; rarer answers score better.
          </p>
        </div>
        <div className='flex gap-2'>
          <Stat icon={<Target />} label='Guesses' value={saved.left} hot={!done} />
          <Stat icon={<Sparkles />} label='Rarity' value={rarity} />
        </div>
      </div>

      {isError && <p className='vx-tile p-6 text-[13.5px] text-subtle'>Today’s grid couldn’t be loaded. Try again in a moment.</p>}

      <section className='vx-tile p-3 sm:p-5'>
        <div className='mx-auto grid max-w-[640px] grid-cols-[minmax(0,0.8fr)_repeat(3,minmax(0,1fr))] gap-1.5 sm:gap-2.5'>
          <div className='flex items-end justify-start p-1.5'>
            <span className='vx-label'>{done ? `${filled}/9 filled` : `${saved.left} left`}</span>
          </div>
          {[0, 1, 2].map((c) => (
            <div key={c} className='flex min-h-14 items-end justify-center px-1 pb-1.5'>
              {grid ? <CriterionLabel criterion={CRITERIA.get(grid.cols[c])!} /> : <span className='h-4 w-20 animate-pulse rounded bg-foreground/[0.06]' />}
            </div>
          ))}
          {[0, 1, 2].map((r) => (
            <React.Fragment key={r}>
              <div className='flex items-center justify-end pr-1.5'>
                {grid ? (
                  <CriterionLabel criterion={CRITERIA.get(grid.rows[r])!} className='justify-end text-right' />
                ) : (
                  <span className='h-4 w-16 animate-pulse rounded bg-foreground/[0.06]' />
                )}
              </div>
              {[0, 1, 2].map((c) => {
                const cell = r * 3 + c;
                const pick = saved.picks[cell] ? COUNTRY_BY_ID.get(saved.picks[cell]!) : undefined;
                const popular = done && !pick ? results?.cells[cell].top[0] : undefined;
                const shownCountry = pick ?? (popular ? COUNTRY_BY_ID.get(popular.id) : undefined);
                return (
                  <button
                    key={cell}
                    type='button'
                    disabled={!grid || (!done && !!pick)}
                    onClick={() => {
                      setMiss(null);
                      setOpen(cell);
                      setDialogOpen(true);
                    }}
                    className={cn(
                      'relative flex aspect-square cursor-pointer flex-col overflow-hidden rounded-[14px] transition-[box-shadow,background-color] disabled:cursor-default',
                      pick ? 'bg-stage shadow-[inset_0_0_0_1.5px_var(--good)]' : 'vx-key enabled:hover:bg-foreground/[0.04]',
                    )}
                    aria-label={pick ? pick.name : `Square ${cell + 1}`}
                  >
                    {shownCountry && (
                      <>
                        <span className={cn('flag-stage min-h-0 flex-1 px-2 pt-2', !pick && 'opacity-40')}>
                          <FlagImage src={shownCountry.image} alt={shownCountry.name} maxHeight={80} area={110 * 72} />
                        </span>
                        <span className='flex h-7 items-center justify-between gap-1 px-2 pb-1.5 text-[11.5px] sm:text-xs'>
                          <span className={cn('truncate font-semibold', !pick && 'text-muted-foreground')}>{shownCountry.name}</span>
                          {pick && percents[cell] !== null && <span className='shrink-0 tabular-nums text-muted-foreground'>{percents[cell]}%</span>}
                        </span>
                      </>
                    )}
                    {!shownCountry && !done && (
                      <span className='m-auto text-muted-foreground opacity-0 transition-opacity [button:hover>&]:opacity-100'>
                        <FlagIcon className='size-5' />
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div className='mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4'>
          {done ? (
            <>
              <p className='min-w-0 flex-1 text-[13.5px] text-subtle'>
                <b className='font-semibold text-foreground'>{filled === 9 ? 'Full grid.' : `${filled} of 9.`}</b> Rarity{' '}
                <b className='tabular-nums font-semibold text-foreground'>{rarity}</b>
                {results && results.players > 0 && <> · {results.players.toLocaleString()} played today</>}. Tap a square to see every answer.
              </p>
              <Button onClick={share}>
                <Share />
                Share
              </Button>
            </>
          ) : (
            <>
              <p className='min-w-0 flex-1 text-[13px] text-muted-foreground'>Lower rarity is better: it’s the share of players who picked the same flag.</p>
              {grid && filled > 0 && (
                <Button variant='ghost' onClick={() => update({ ...saved, left: 0 })}>
                  Give up
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      {done && (
        <section className='vx-tile mt-4 flex flex-wrap items-center gap-2 p-5'>
          <Stat icon={<Target />} label='Played' value={stats.played} />
          <Stat icon={<Trophy />} label='Full grids' value={stats.perfect} />
          <Stat icon={<Sparkles />} label='Best rarity' value={stats.best ?? '—'} />
          {results && <Stat icon={<Users />} label='Players today' value={results.players.toLocaleString()} />}
          <span className='ml-auto'>
            <Countdown label='Next grid' />
          </span>
        </section>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='gap-3 sm:max-w-md'>
          {openCell && (
            <>
              <DialogTitle className='pr-6 text-base font-semibold tracking-[-0.02em]'>
                {openCell[0].label} <span className='font-normal text-muted-foreground'>and</span> {openCell[1].label.charAt(0).toLowerCase() + openCell[1].label.slice(1)}
              </DialogTitle>
              {done ? (
                <>
                  <DialogDescription className='text-[13px]'>
                    {openAnswers.length} {openAnswers.length === 1 ? 'country fits' : 'countries fit'}. Percentages are how many players picked each.
                  </DialogDescription>
                  <ul className='-mx-1 flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto px-1'>
                    {openAnswers.map((country) => {
                      const percent = results?.cells[open!].percents[country.id];
                      const mine = saved.picks[open!] === country.id;
                      return (
                        <li key={country.id}>
                          <Link
                            href={country.href}
                            className={cn('flex h-10 items-center gap-3 rounded-[9px] px-2 text-[14px] hover:bg-foreground/[0.05]', mine && 'bg-good-soft')}
                          >
                            <span className='flag-stage h-6 w-9 shrink-0'>
                              <FlagImage src={country.image} alt='' maxHeight={22} area={32 * 21} />
                            </span>
                            <span className='min-w-0 flex-1 truncate font-medium'>{country.name}</span>
                            {percent !== undefined && <span className='tabular-nums text-xs text-muted-foreground'>{percent}%</span>}
                            <ArrowUpRight className='size-3.5 text-muted-foreground' />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <>
                  <DialogDescription className='text-[13px]'>
                    {saved.left} {saved.left === 1 ? 'guess' : 'guesses'} left. A wrong answer uses one up.
                  </DialogDescription>
                  <CountryPicker onPick={guess} used={used} autoFocus disabled={busy} />
                  {miss && <p className='text-[13px] font-medium text-bad'>{miss}</p>}
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
