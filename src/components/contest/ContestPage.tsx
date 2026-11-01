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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DEFAULT_RULES, formatContestDate } from '@/lib/contest';
import { openSignIn } from '@/lib/sign-in';
import { cn } from '@/lib/utils';
import { ContestDate, ContestTimeline, initials } from './contest-ui';

type Contest = ContestView['contest'];

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'];

export default function ContestPage({ view, archive }: { view: ContestView; archive: ArchivedContest[] }) {
  const phase = view.contest.phase;
  return (
    <div className='mx-auto max-w-[960px] px-4 pb-28 md:px-8'>
      {phase === 'results' ? <Results view={view} /> : phase === 'voting' || phase === 'judging' ? <Ballot view={view} /> : <Prompt view={view} />}
      {archive.length > 0 && <PastContests archive={archive} />}
    </div>
  );
}

// ───────────────────────── The heading every phase before the results shares ─────────────────────────

function ContestHeader({ contest }: { contest: Contest }) {
  return (
    <>
      <span className='vx-label block'>Design contest · {contest.title}</span>
      <h1 className='mt-0.5 text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] sm:text-[30px]'>{contest.theme}</h1>
      <ContestTimeline contest={contest} />
    </>
  );
}

// ───────────────────────── Before voting: the brief ─────────────────────────

function Prompt({ view }: { view: ContestView }) {
  const { contest, myEntry } = view;
  const router = useRouter();
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [withdrawing, setWithdrawing] = React.useState(false);
  const open = contest.phase === 'open';
  const entered = open ? myEntry : null;

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

  const copy = (
    <>
      {contest.brief && <p className='max-w-[580px] whitespace-pre-line text-[14.5px] leading-[1.6] text-subtle'>{contest.brief}</p>}
      {contest.prize && !entered && <p className='mt-2.5 max-w-[580px] text-[14.5px] leading-[1.6] text-subtle'>{contest.prize}</p>}
      <div className='mt-5 flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[13px] text-subtle'>
        <Button asChild size='lg'>
          <Link href={action.href}>{action.label}</Link>
        </Button>
        <button type='button' onClick={() => setRulesOpen(true)} className='cursor-pointer font-medium text-main hover:underline'>
          Rules
        </button>
        {entered ? (
          <button type='button' onClick={withdraw} disabled={withdrawing} className='inline-flex cursor-pointer items-center gap-1 hover:text-foreground'>
            {withdrawing && <Loader2 className='size-3.5 animate-spin' />}
            Withdraw
          </button>
        ) : (
          open &&
          contest.entryCount > 0 && (
            <span>
              {contest.entryCount} {contest.entryCount === 1 ? 'flag' : 'flags'} entered so far
            </span>
          )
        )}
      </div>
    </>
  );

  return (
    <section className='pt-8 sm:pt-11'>
      <ContestHeader contest={contest} />

      {entered ? (
        <div className='mt-[26px] grid items-start gap-8 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'>
          <div>{copy}</div>
          <div className='rounded-[14px] bg-stage px-4 pb-3 pt-[18px]'>
            <div className='flag-stage aspect-[3/2] w-full'>
              <FlagImage src={entered.image} alt={entered.title} maxHeight={300} area={450 * 300} />
            </div>
            <p className='mt-3 truncate text-[13.5px] font-medium'>{entered.title}</p>
            <p className='mt-px text-[12.5px] text-muted-foreground'>
              Your entry · voters see it <ContestDate date={contest.votingStartsAt} />
            </p>
          </div>
        </div>
      ) : (
        <div className='mt-[26px]'>{copy}</div>
      )}

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
      <ContestHeader contest={contest} />
      <p className='mt-6 text-[14.5px] leading-normal text-subtle'>
        {voting ? `Pick the ${NUMBER_WORDS[total] || total} you’d fly. Names stay hidden until the winner is out.` : 'Voting has closed. The winner is announced soon.'}
      </p>

      {view.entries.length === 0 ? (
        <p className='vx-tile mt-7 p-8 text-center text-[14px] text-muted-foreground'>No entries this time.</p>
      ) : (
        <div className='mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4'>
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
                  'relative h-[134px] rounded-[13px] bg-stage text-left shadow-tile transition-[box-shadow,background-color] sm:h-[165px] sm:rounded-[14px] lg:h-[188px]',
                  voting && !entry.mine && 'cursor-pointer hover:shadow-tile-hover',
                  picked && 'bg-main-soft shadow-[0_0_0_2.5px_var(--main)] hover:shadow-[0_0_0_2.5px_var(--main)]',
                  entry.mine && 'opacity-55',
                )}
              >
                <span className='flag-stage absolute inset-x-4 bottom-9 top-5 sm:inset-x-6 sm:bottom-10 sm:top-6'>
                  <FlagImage src={entry.image} alt={entry.title} maxHeight={110} area={165 * 110} />
                </span>
                <span
                  className={cn(
                    'absolute bottom-2 left-3 right-3 truncate text-[12px] font-medium text-subtle sm:bottom-2.5 sm:text-[13px]',
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
                {entry.mine && <span className='absolute right-3 top-0.5 text-[12px] text-muted-foreground sm:right-3.5 sm:top-1.5'>Yours</span>}
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

// ───────────────────────── Results: the winner ─────────────────────────

function Results({ view }: { view: ContestView }) {
  const { contest, winner, finalists } = view;
  const [open, setOpen] = React.useState<number | null>(null);
  const count = finalists.length + (winner ? 1 : 0);
  // The winner's name is the page heading once there is one.
  const Theme = winner ? 'p' : 'h1';
  return (
    <section className='pt-8 sm:pt-11'>
      <span className='vx-label block'>Design contest · {contest.title}</span>
      <Theme className='mt-0.5 text-[15px] font-medium text-subtle'>{contest.theme}</Theme>
      {winner && <Winner contest={contest} winner={winner} />}
      {finalists.length > 0 && (
        <div className='mt-8'>
          <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
            <h2 className='text-[15px] font-semibold'>{winner ? 'Everyone else who entered' : 'Every entry'}</h2>
            <span className='vx-label'>
              {count} {count === 1 ? 'flag' : 'flags'}
            </span>
          </div>
          <div className='mt-3 grid grid-cols-2 gap-x-2.5 gap-y-4 sm:grid-cols-4'>
            {finalists.map((entry, index) => (
              <button key={entry.id} type='button' onClick={() => setOpen(index)} className='group min-w-0 cursor-zoom-in text-left'>
                <span className='flag-stage h-[118px] rounded-xl bg-stage p-5 shadow-tile transition-[box-shadow] duration-300 group-hover:shadow-tile-hover'>
                  <FlagImage src={entry.image} alt={entry.title} maxHeight={78} area={116 * 78} />
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
        </div>
      )}
    </section>
  );
}

function Winner({ winner, contest }: { contest: Contest; winner: NamedEntry }) {
  return (
    <div className='mt-5 grid items-center gap-6 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] sm:gap-8'>
      <div className='flag-stage aspect-[3/2] w-full'>
        <FlagImage src={winner.image} alt={winner.title} maxHeight={400} area={600 * 400} eager />
      </div>
      <div className='min-w-0'>
        <span className='text-[12.5px] font-semibold text-[#9a6a00] dark:text-[#f2c14e]'>{contest.title} winner</span>
        <h1 className='mt-1 break-words text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[30px]'>{winner.title}</h1>
        <Link href={`/profile/${winner.designer.userNumber}`} className='mt-2.5 inline-flex items-center gap-2 text-[14px] hover:underline'>
          <Avatar className='size-[26px]'>
            {winner.designer.image && <AvatarImage src={winner.designer.image} alt='' className='object-cover' />}
            <AvatarFallback className='text-[10.5px]'>{initials(winner.designer.name)}</AvatarFallback>
          </Avatar>
          {winner.designer.name}
        </Link>
        {winner.statement && <p className='mt-3 text-[14px] leading-relaxed text-subtle'>{winner.statement}</p>}
        {winner.flagId && (
          <Link href={`/flag/${encodeURIComponent(winner.title)}`} className='mt-3 inline-block text-[13px] font-medium text-main hover:underline'>
            Open flag
          </Link>
        )}
      </div>
    </div>
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
