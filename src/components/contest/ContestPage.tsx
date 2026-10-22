'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  type AnonymousEntry,
  type ArchivedContest,
  type ContestView,
  type NamedEntry,
  toggleContestVote,
  withdrawContestEntry,
} from '@/actions/contests';
import { Calendar, Check, ChevronLeft, ChevronRight, Loader2 } from '@/components/icons';
import FlagImage from '@/components/FlagImage';
import WavingFlag from '@/components/WavingFlag';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DEFAULT_RULES, formatContestDate, phaseEndsAt } from '@/lib/contest';
import { openSignIn } from '@/lib/sign-in';
import { cn } from '@/lib/utils';
import { Countdown, CountdownText, initials } from './contest-ui';

type Contest = ContestView['contest'];

const COUNTDOWN_LABEL = {
  upcoming: 'Entries open in',
  open: 'Entries close in',
  voting: 'Voting closes in',
} as const;

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'];

export default function ContestPage({ view, archive }: { view: ContestView; archive: ArchivedContest[] }) {
  const phase = view.contest.phase;
  return (
    <div className='mx-auto max-w-[1180px] px-4 pb-28 md:px-8'>
      {phase === 'results' ? <Results view={view} /> : phase === 'voting' || phase === 'judging' ? <Ballot view={view} /> : <PromptFlag view={view} />}
      {archive.length > 0 && <PastContests archive={archive} />}
    </div>
  );
}

// ───────────────────────── Before voting: the prompt on a flag ─────────────────────────

function PromptFlag({ view }: { view: ContestView }) {
  const { contest, myEntry } = view;
  const phase = contest.phase;
  const ends = phaseEndsAt(contest, phase);
  const router = useRouter();
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [withdrawing, setWithdrawing] = React.useState(false);
  const open = phase === 'open';

  async function withdraw() {
    if (!confirm('Withdraw your entry? You can enter again until entries close.')) return;
    setWithdrawing(true);
    const result = await withdrawContestEntry(contest.id);
    setWithdrawing(false);
    if (!result.success) toast.error(result.message);
    else {
      toast('Entry withdrawn');
      router.refresh();
    }
  }

  const action = open
    ? { href: `/create?contest=${contest.slug}`, label: myEntry ? 'Edit your entry' : 'Start your entry' }
    : { href: '/create', label: 'Warm up in the flag maker' };
  const clock = ends && (
    <div>
      <p className='mb-2.5 text-[12.5px] opacity-60'>{COUNTDOWN_LABEL[phase as keyof typeof COUNTDOWN_LABEL]}</p>
      <Countdown to={ends} />
    </div>
  );

  const notes: React.ReactNode[] = [];
  if (open && myEntry) {
    notes.push(
      <span key='entry'>
        You’re in with <span className='font-semibold text-foreground'>{myEntry.title}</span>
      </span>,
      <button key='withdraw' type='button' onClick={withdraw} disabled={withdrawing} className='inline-flex cursor-pointer items-center gap-1 hover:text-foreground'>
        {withdrawing && <Loader2 className='size-3.5 animate-spin' />}
        Withdraw
      </button>,
    );
  } else if (open && contest.entryCount > 0) {
    notes.push(
      <span key='count'>
        {contest.entryCount} {contest.entryCount === 1 ? 'flag' : 'flags'} entered so far
      </span>,
    );
  }
  notes.push(
    <button key='rules' type='button' onClick={() => setRulesOpen(true)} className='cursor-pointer font-medium text-main hover:underline'>
      Rules
    </button>,
  );

  return (
    <section className='pt-16 lg:pt-[110px]'>
      <div className='contest-mast mx-auto max-w-[769px] [--pole-below:-56px] lg:[--pole-below:-150px]'>
        <span className='contest-pole' />
        <span className='contest-finial' />
        <div className='contest-cloth'>
          <div className='contest-wave flex aspect-[3/2] flex-col px-[22px] py-6 sm:p-9 lg:px-[52px] lg:pb-10 lg:pt-[46px]'>
            <span className='text-[12.5px] font-medium text-white/60 lg:text-[13.5px]'>Design contest · {contest.title}</span>
            <h1 className='mt-auto text-[31px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[46px] lg:mt-[18px] lg:text-[58px]'>
              {contest.theme}
            </h1>
            {contest.brief && (
              <p className='mt-[18px] hidden max-w-[470px] whitespace-pre-line text-[16.5px] leading-relaxed text-white/80 lg:block'>{contest.brief}</p>
            )}
            <div className='mt-auto hidden items-end justify-between gap-6 lg:flex'>
              <Link
                href={action.href}
                className='inline-flex h-12 items-center rounded-[11px] bg-white px-[22px] text-[15px] font-semibold text-[#203f8f] transition-colors hover:bg-white/90'
              >
                {action.label}
              </Link>
              {clock && <div className='text-right [&_[role=timer]]:justify-end'>{clock}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className='mx-auto mt-12 max-w-[560px] lg:hidden'>
        {contest.brief && <p className='whitespace-pre-line text-[15.5px] leading-relaxed text-subtle'>{contest.brief}</p>}
        {clock && <div className='mt-7 [&_p]:text-muted-foreground [&_p]:opacity-100'>{clock}</div>}
        <Button asChild size='lg' className='mt-7 h-12 w-full text-[15px]'>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      </div>

      <div className='mx-auto mt-6 max-w-[560px] text-[14px] text-subtle lg:mt-8 lg:max-w-[769px] lg:pl-[61px]'>
        <p className='flex flex-wrap items-center gap-x-2'>
          {notes.map((note, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span aria-hidden>·</span>}
              {note}
            </React.Fragment>
          ))}
        </p>
        {contest.prize && <p className='mt-1.5 max-w-[470px]'>Prize: {contest.prize}</p>}
      </div>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className='max-w-[460px] sm:max-w-[460px]'>
          <DialogTitle>Rules</DialogTitle>
          <DialogDescription className='sr-only'>The rules for {contest.theme}</DialogDescription>
          <ul className='grid gap-2.5 text-[14px] text-subtle'>
            {(contest.rules.length ? contest.rules : DEFAULT_RULES).map((rule) => (
              <li key={rule} className='flex gap-2.5'>
                <span className='mt-[9px] size-1 shrink-0 rounded-full bg-current' />
                {rule}
              </li>
            ))}
          </ul>
          {open && (
            <p className='text-[13px] text-muted-foreground'>
              Entries close {formatContestDate(contest.votingStartsAt, true)}. Voting runs until {formatContestDate(contest.endsAt, true)}.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ───────────────────────── Voting: pick your favourites ─────────────────────────

function Ballot({ view }: { view: ContestView }) {
  const { contest } = view;
  const voting = contest.phase === 'voting';
  const ends = phaseEndsAt(contest, contest.phase);
  const [votes, setVotes] = React.useState<string[]>(view.myVotes);
  const [pending, setPending] = React.useState<string | null>(null);
  const total = contest.votesPerVoter;
  const left = total - votes.length;
  const byId = React.useMemo(() => new Map(view.entries.map((entry) => [entry.id, entry])), [view.entries]);

  async function vote(entry: AnonymousEntry) {
    if (!view.signedIn) {
      openSignIn();
      return;
    }
    const had = votes.includes(entry.id);
    if (!had && left <= 0) {
      toast(`You’ve picked ${NUMBER_WORDS[total] || total} already`, { description: 'Tap one of your picks to swap it out.' });
      return;
    }
    setPending(entry.id);
    setVotes((current) => (had ? current.filter((id) => id !== entry.id) : [...current, entry.id]));
    const result = await toggleContestVote(entry.id);
    setPending(null);
    // Keep the order picks were made in, so the tray doesn't reshuffle.
    if (result.success) setVotes((current) => [...current.filter((id) => result.votes.includes(id)), ...result.votes.filter((id) => !current.includes(id))]);
    else {
      setVotes((current) => (had ? [...current, entry.id] : current.filter((id) => id !== entry.id)));
      toast.error(result.message);
    }
  }

  return (
    <section className='pt-8 sm:pt-11'>
      <div className='flex flex-wrap items-end justify-between gap-x-8 gap-y-3'>
        <div className='min-w-0'>
          <span className='vx-label sm:text-[13.5px]'>Design contest · {contest.title}</span>
          <h1 className='mt-1 text-[27px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[38px]'>{contest.theme}</h1>
          <p className='mt-2 text-[14px] text-subtle sm:text-[14.5px]'>
            {voting
              ? `Pick the ${NUMBER_WORDS[total] || total} you’d fly. Names stay hidden until the winner is out.`
              : 'Voting has closed. The winner goes up the pole soon.'}
          </p>
        </div>
        {voting && ends && (
          <div className='sm:text-right'>
            <span className='vx-label'>Voting closes in</span>
            <CountdownText to={ends} className='block text-[20px] font-semibold tracking-[-0.02em] sm:text-[22px]' />
          </div>
        )}
      </div>

      {view.entries.length === 0 ? (
        <p className='vx-tile mt-7 p-8 text-center text-[14px] text-muted-foreground'>No entries this time.</p>
      ) : (
        <div className='mt-6 grid grid-cols-2 gap-2.5 sm:mt-7 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'>
          {view.entries.map((entry) => {
            const picked = votes.includes(entry.id);
            return (
              <button
                key={entry.id}
                type='button'
                aria-pressed={voting ? picked : undefined}
                disabled={!voting || entry.mine || pending === entry.id}
                onClick={() => vote(entry)}
                title={entry.statement || undefined}
                className={cn(
                  'relative h-[134px] rounded-[13px] bg-stage text-left shadow-tile transition-[box-shadow,background-color] sm:h-[200px] sm:rounded-2xl lg:h-[238px]',
                  voting && !entry.mine && 'cursor-pointer hover:shadow-tile-hover',
                  picked && 'bg-main-soft shadow-[0_0_0_2.5px_var(--main)] hover:shadow-[0_0_0_2.5px_var(--main)]',
                  entry.mine && 'opacity-55',
                )}
              >
                <span className='flag-stage absolute inset-x-4 bottom-9 top-5 sm:inset-x-8 sm:bottom-12 sm:top-9'>
                  <FlagImage src={entry.image} alt={entry.title} maxHeight={136} area={210 * 136} />
                </span>
                <span
                  className={cn(
                    'absolute bottom-2 left-3 right-3 truncate text-[12px] font-medium text-subtle sm:bottom-3 sm:left-4 sm:right-4 sm:text-[13.5px]',
                    picked && 'text-main',
                  )}
                >
                  {entry.title}
                </span>
                {picked && (
                  <span className='absolute right-2 top-2 grid size-[22px] place-items-center rounded-full bg-main text-main-foreground sm:right-3 sm:top-3 sm:size-7'>
                    <Check className='size-3 sm:size-[15px]' />
                  </span>
                )}
                {entry.mine && <span className='absolute right-3 top-2 text-[12px] text-muted-foreground sm:right-3.5 sm:top-3'>Yours</span>}
              </button>
            );
          })}
        </div>
      )}

      {voting && view.entries.length > 0 && (
        <div className='pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:bottom-7'>
          <div className='pointer-events-auto flex w-full max-w-[440px] items-center justify-between gap-4 rounded-[18px] bg-surface py-2.5 pl-4 pr-2.5 shadow-pop sm:w-auto sm:max-w-none sm:py-3 sm:pl-5 sm:pr-3.5'>
            <div className='text-[12.5px] leading-tight text-muted-foreground sm:text-[13px]'>
              <span className='block text-[13.5px] font-semibold text-foreground sm:text-[14.5px]'>Your picks</span>
              {!view.signedIn ? (
                <button type='button' onClick={() => openSignIn()} className='cursor-pointer font-medium text-main hover:underline'>
                  Sign in to pick
                </button>
              ) : left > 0 ? (
                <>
                  {left} left<span className='hidden sm:inline'> · saved as you go</span>
                </>
              ) : (
                'All picked · saved'
              )}
            </div>
            <div className='flex gap-1.5 sm:gap-2'>
              {Array.from({ length: total }, (_, index) => {
                const entry = byId.get(votes[index]);
                return entry ? (
                  <button
                    key={entry.id}
                    type='button'
                    onClick={() => vote(entry)}
                    aria-label={`Remove ${entry.title} from your picks`}
                    title={`Remove ${entry.title}`}
                    className='h-9 w-[54px] cursor-pointer overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgb(28_29_31/0.15),0_4px_8px_-2px_rgb(28_29_31/0.25)] transition-transform hover:-translate-y-0.5 sm:h-11 sm:w-[66px]'
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.image} alt='' className='size-full object-cover' />
                  </button>
                ) : (
                  <span key={`empty-${index}`} className='contest-slot h-9 w-[54px] rounded-[4px] sm:h-11 sm:w-[66px]' />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ───────────────────────── Results: the winner, hoisted ─────────────────────────

function Results({ view }: { view: ContestView }) {
  const { contest, winner, finalists } = view;
  const [open, setOpen] = React.useState<number | null>(null);
  const count = finalists.length + (winner ? 1 : 0);
  return (
    <>
      {winner && <Winner contest={contest} winner={winner} />}
      {finalists.length > 0 && (
        <section className={winner ? 'mt-16 lg:mt-20' : 'pt-11'}>
          <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
            <h2 className='text-[17px] font-semibold tracking-[-0.02em]'>{winner ? 'Everyone else who entered' : 'Every entry'}</h2>
            <span className='vx-label'>
              {count} flags · {contest.theme}
            </span>
          </div>
          <div className='mt-4 grid grid-cols-2 gap-x-3.5 gap-y-5 sm:grid-cols-4 lg:grid-cols-6'>
            {finalists.map((entry, index) => (
              <button key={entry.id} type='button' onClick={() => setOpen(index)} className='group min-w-0 cursor-zoom-in text-left'>
                <span className='flag-stage h-[118px] rounded-xl bg-stage p-5 shadow-tile transition-[box-shadow] duration-300 group-hover:shadow-tile-hover'>
                  <FlagImage src={entry.image} alt={entry.title} maxHeight={64} area={110 * 64} />
                </span>
                <span className='mt-2 block truncate text-[13px] font-medium'>{entry.title}</span>
                <span className='block truncate text-[12px] text-muted-foreground'>{entry.designer.name}</span>
              </button>
            ))}
          </div>
          <Lightbox
            entries={finalists}
            index={open}
            onIndex={setOpen}
            renderMeta={(entry) => (
              <Link href={`/profile/${entry.designer.userNumber}`} className='mt-0.5 block text-[13.5px] text-muted-foreground hover:underline'>
                by {entry.designer.name}
              </Link>
            )}
          />
        </section>
      )}
    </>
  );
}

function Winner({ contest, winner }: { contest: Contest; winner: NamedEntry }) {
  return (
    <section className='grid items-center gap-6 pt-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12 lg:pt-12'>
      <div>
        <div className='relative h-[300px] [mask-image:linear-gradient(180deg,#000_88%,transparent)] sm:h-[420px] lg:h-[500px]'>
          <WavingFlag src={winner.image} alt={winner.title} className='absolute inset-0' />
        </div>
        <p className='mt-1 text-center text-[12.5px] text-muted-foreground'>Drag to turn it</p>
      </div>
      <div className='min-w-0 lg:pb-8'>
        <span className='text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#9a6a00] dark:text-[#f2c14e]'>{contest.title} winner</span>
        <h1 className='mt-2.5 break-words text-[42px] font-semibold leading-none tracking-[-0.05em] sm:text-[64px]'>{winner.title}</h1>
        <Link href={`/profile/${winner.designer.userNumber}`} className='mt-4 inline-flex items-center gap-2.5 text-[15.5px] hover:underline'>
          <Avatar className='size-7'>
            {winner.designer.image && <AvatarImage src={winner.designer.image} alt='' className='object-cover' />}
            <AvatarFallback className='text-[10.5px]'>{initials(winner.designer.name)}</AvatarFallback>
          </Avatar>
          <span>
            by <span className='font-semibold'>{winner.designer.name}</span>
          </span>
        </Link>
        {winner.statement && <p className='mt-5 max-w-[440px] text-[16px] leading-relaxed text-subtle sm:text-[17px]'>“{winner.statement}”</p>}
        <div className='mt-7 flex flex-wrap gap-2.5'>
          {winner.flagId && (
            <Button asChild>
              <Link href={`/flag/${encodeURIComponent(winner.title)}`}>Open flag</Link>
            </Button>
          )}
          <Button asChild variant='neutral'>
            <Link href={`/profile/${winner.designer.userNumber}`}>{winner.designer.name}’s profile</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Lightbox<T extends Pick<AnonymousEntry, 'id' | 'title' | 'statement' | 'image'>>({
  entries,
  index,
  onIndex,
  renderMeta,
}: {
  entries: T[];
  index: number | null;
  onIndex: (index: number | null) => void;
  renderMeta?: (entry: T) => React.ReactNode;
}) {
  const entry = index === null ? null : entries[index];
  const step = React.useCallback(
    (by: number) => index !== null && onIndex((index + by + entries.length) % entries.length),
    [index, entries.length, onIndex],
  );
  React.useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, step]);

  return (
    <Dialog open={entry !== null} onOpenChange={(next) => !next && onIndex(null)}>
      <DialogContent className='w-[calc(100%-2rem)] max-w-[760px] gap-0 overflow-hidden p-0 sm:max-w-[760px]'>
        {entry && (
          <>
            <div className='flag-stage relative h-[300px] bg-stage p-10 sm:h-[440px] sm:p-14'>
              <FlagImage src={entry.image} alt={entry.title} maxHeight={340} area={560 * 340} />
              {entries.length > 1 && (
                <>
                  <button
                    type='button'
                    aria-label='Previous entry'
                    onClick={() => step(-1)}
                    className='absolute left-3 top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface/90 shadow-pop hover:bg-surface'
                  >
                    <ChevronLeft className='size-4' />
                  </button>
                  <button
                    type='button'
                    aria-label='Next entry'
                    onClick={() => step(1)}
                    className='absolute right-3 top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface/90 shadow-pop hover:bg-surface'
                  >
                    <ChevronRight className='size-4' />
                  </button>
                </>
              )}
            </div>
            <div className='p-5 sm:p-6'>
              <DialogTitle className='text-[19px]'>{entry.title}</DialogTitle>
              {renderMeta?.(entry)}
              <DialogDescription className={cn('mt-1.5 text-[14px] leading-relaxed text-subtle', !entry.statement && 'sr-only')}>
                {entry.statement || 'No designer statement.'}
              </DialogDescription>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Archive ─────────────────────────

function PastContests({ archive }: { archive: ArchivedContest[] }) {
  return (
    <section id='past' className='mt-24 scroll-mt-20'>
      <h2 className='text-[17px] font-semibold tracking-[-0.02em]'>Past contests</h2>
      <div className='mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {archive.map((contest) => (
          <Link
            key={contest.id}
            href={`/contest/${contest.slug}`}
            className='vx-tile group flex flex-col overflow-hidden transition-[box-shadow] duration-300 hover:shadow-tile-hover'
          >
            <div className='flag-stage grid h-[120px] place-items-center bg-stage p-5'>
              {contest.winner ? (
                <FlagImage src={contest.winner.image} alt={contest.winner.title} maxHeight={70} area={110 * 70} />
              ) : (
                <Calendar className='size-6 text-muted-foreground' />
              )}
            </div>
            <div className='p-3.5'>
              <span className='block text-[11.5px] text-muted-foreground'>{contest.title}</span>
              <span className='block truncate text-[14px] font-medium'>{contest.theme}</span>
              <span className='mt-0.5 block truncate text-[12.5px] text-subtle'>
                {contest.winner ? `Won by ${contest.winner.designer}` : 'Winner coming soon'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
