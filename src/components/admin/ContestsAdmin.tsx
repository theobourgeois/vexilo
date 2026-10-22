'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  announceContest,
  deleteContest,
  featureContestWinner,
  getContestAdmin,
  listContestsAdmin,
  publishContestEntries,
  restoreVotes,
  saveContest,
  setContestWinner,
  setEntryStatus,
  voidVotes,
  type AdminEntry,
  type AdminVoter,
  type ContestAdminView,
  type ContestInput,
  type VoterSignal,
} from '@/actions/contest-admin';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  ExternalLink,
  Eye,
  EyeSlash,
  Flag,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  Undo,
  Users,
} from '@/components/icons';
import { initials, PhasePill } from '@/components/contest/contest-ui';
import FlagImage from '@/components/FlagImage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_RULES, formatContestDate, formatRange, slugify } from '@/lib/contest';
import { cn } from '@/lib/utils';

const SIGNALS: Record<VoterSignal, { label: string; hint: string }> = {
  'entrant-network': { label: 'Same network as entrant', hint: 'Voted from the same network the entry was submitted from' },
  'shared-network': { label: 'Shared network', hint: 'Other voters voted from the same network' },
  'new-account': { label: 'New account', hint: 'Account made after the contest started' },
  'no-history': { label: 'No history', hint: 'Never favourited or submitted a flag' },
};

/** The strongest signs of a sock puppet come first. */
const SIGNAL_ORDER: VoterSignal[] = ['entrant-network', 'shared-network', 'new-account', 'no-history'];

export function ContestsAdmin() {
  const searchParams = useSearchParams();
  const id = searchParams.get('contest');
  if (id === 'new') return <NewContest />;
  if (id) return <ContestDetail id={id} />;
  return <ContestList />;
}

function useGoTo() {
  const router = useRouter();
  return (contest?: string, tab?: string) =>
    router.push(`/admin?view=contests${contest ? `&contest=${contest}` : ''}${tab ? `&tab=${tab}` : ''}`);
}

// ───────────────────────── List ─────────────────────────

function ContestList() {
  const goTo = useGoTo();
  const { data, isLoading } = useQuery({ queryKey: ['contestsAdmin'], queryFn: () => listContestsAdmin() });

  return (
    <div>
      <div className='flex items-end justify-between gap-4'>
        <div>
          <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Contests</h1>
          <p className='mt-0.5 text-[13px] text-muted-foreground'>Monthly design contests. Only you can see drafts and vote counts.</p>
        </div>
        <Button onClick={() => goTo('new')}>
          <Plus />
          New contest
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className='mx-auto mt-16 size-6 animate-spin text-muted-foreground' />
      ) : !data?.length ? (
        <div className='vx-tile mt-6 flex flex-col items-center gap-2 p-12 text-center'>
          <Trophy className='size-7 text-muted-foreground' />
          <p className='text-[15px] font-semibold'>No contests yet</p>
          <p className='text-[13.5px] text-subtle'>Set up the first one. It stays a draft until you publish it.</p>
          <Button className='mt-3' onClick={() => goTo('new')}>
            <Plus />
            New contest
          </Button>
        </div>
      ) : (
        <div className='vx-tile mt-6 divide-y divide-line overflow-hidden'>
          {data.map((contest) => (
            <button
              key={contest.id}
              type='button'
              onClick={() => goTo(contest.id)}
              className='flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.03]'
            >
              <span className='flag-stage grid h-[46px] w-[66px] shrink-0 place-items-center overflow-hidden rounded-[9px] bg-stage'>
                {contest.winnerImage ? (
                  <FlagImage src={contest.winnerImage} alt='' maxHeight={32} area={50 * 32} />
                ) : (
                  <Trophy className='size-4 text-muted-foreground' />
                )}
              </span>
              <span className='min-w-0 flex-1'>
                <span className='flex items-center gap-2'>
                  <span className='truncate text-[14.5px] font-semibold'>{contest.theme}</span>
                  <PhasePill phase={contest.phase} className='h-5 px-2 text-[11px]' />
                </span>
                <span className='block truncate text-[12.5px] text-muted-foreground'>
                  {contest.title} · {formatRange(contest.startsAt, contest.endsAt)} · /contest/{contest.slug}
                </span>
              </span>
              <span className='hidden w-20 text-right sm:block'>
                <span className='block text-[15px] font-semibold tabular-nums'>{contest.entries}</span>
                <span className='block text-[11.5px] text-muted-foreground'>entries</span>
              </span>
              <span className='hidden w-20 text-right sm:block'>
                <span className='block text-[15px] font-semibold tabular-nums'>{contest.votes}</span>
                <span className='block text-[11.5px] text-muted-foreground'>votes</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Create & edit ─────────────────────────

/** Entries for three weeks from the 1st of next month, a week of voting, results right after. */
function nextMonthDefaults(): ContestInput {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const month = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return {
    id: null,
    slug: '',
    title: month,
    theme: '',
    brief: '',
    rules: DEFAULT_RULES,
    prize: 'The winner becomes flag of the day and gets a winner’s badge on their profile.',
    startsAt: start,
    votingStartsAt: new Date(start.getFullYear(), start.getMonth(), 22),
    endsAt: new Date(start.getFullYear(), start.getMonth(), 29),
    votesPerVoter: 3,
    published: false,
  };
}

function NewContest() {
  const goTo = useGoTo();
  return (
    <div>
      <button type='button' onClick={() => goTo()} className='vx-label inline-flex cursor-pointer items-center gap-1.5 hover:text-foreground'>
        <ArrowLeft className='size-3.5' />
        Contests
      </button>
      <h1 className='mt-2 text-[22px] font-semibold tracking-[-0.03em]'>New contest</h1>
      <ContestForm initial={nextMonthDefaults()} onSaved={(id) => goTo(id)} className='mt-6' />
    </div>
  );
}

const toLocalInput = (date: Date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className='mb-1.5 block text-[13px] font-medium'>{label}</span>
      {children}
      {hint && <span className='mt-1 block text-[12px] text-muted-foreground'>{hint}</span>}
    </label>
  );
}

const TEXTAREA = 'vx-well w-full resize-y rounded-[12px] px-3.5 py-3 text-[14px] outline-none focus:ring-2 focus:ring-ring';

function ContestForm({
  initial,
  onSaved,
  locked,
  className,
}: {
  initial: ContestInput;
  onSaved: (id: string) => void;
  /** Entries exist, so dates that already passed shouldn't move by accident. */
  locked?: boolean;
  className?: string;
}) {
  const [form, setForm] = React.useState({
    ...initial,
    rulesText: (initial.rules ?? []).join('\n'),
    startsAt: toLocalInput(initial.startsAt as Date),
    votingStartsAt: toLocalInput(initial.votingStartsAt as Date),
    endsAt: toLocalInput(initial.endsAt as Date),
  });
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await saveContest({
      id: form.id,
      slug: form.slug || slugify(form.title),
      title: form.title,
      theme: form.theme,
      brief: form.brief,
      rules: form.rulesText
        .split('\n')
        .map((rule) => rule.trim())
        .filter(Boolean),
      prize: form.prize,
      startsAt: new Date(form.startsAt),
      votingStartsAt: new Date(form.votingStartsAt),
      endsAt: new Date(form.endsAt),
      votesPerVoter: Number(form.votesPerVoter),
      published: form.published,
    });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(form.id ? 'Saved' : 'Contest created');
    onSaved(result.id);
  }

  return (
    <form onSubmit={save} className={cn('grid gap-6 lg:grid-cols-[1fr_320px]', className)}>
      <div className='vx-tile grid gap-5 p-5 sm:p-6'>
        <div className='grid gap-5 sm:grid-cols-2'>
          <Field label='Name' hint='Usually the month.'>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder='November 2026' required />
          </Field>
          <Field label='Link' hint={`vexilo.org/contest/${form.slug || slugify(form.title) || '…'}`}>
            <Input value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} placeholder={slugify(form.title)} />
          </Field>
        </div>
        <Field label='Theme' hint='The big line on the contest page.'>
          <Input value={form.theme} onChange={(e) => set('theme', e.target.value)} placeholder='Your hometown, reimagined' required className='text-[16px] font-semibold' />
        </Field>
        <Field label='Brief' hint='What you’re asking people to design, and what you’re looking for.'>
          <textarea value={form.brief} onChange={(e) => set('brief', e.target.value)} rows={4} className={TEXTAREA} />
        </Field>
        <Field label='Rules' hint='One per line.'>
          <textarea value={form.rulesText} onChange={(e) => set('rulesText', e.target.value)} rows={6} className={TEXTAREA} />
        </Field>
        <Field label='Prize'>
          <Input value={form.prize} onChange={(e) => set('prize', e.target.value)} />
        </Field>
      </div>

      <div className='flex flex-col gap-4'>
        <div className='vx-tile grid gap-4 p-5'>
          <span className='vx-label'>Schedule</span>
          <Field label='Entries open'>
            <Input type='datetime-local' value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} required />
          </Field>
          <Field label='Voting opens' hint='Entries close at the same moment.'>
            <Input type='datetime-local' value={form.votingStartsAt} onChange={(e) => set('votingStartsAt', e.target.value)} required />
          </Field>
          <Field label='Voting closes' hint='Then you pick and announce the winner.'>
            <Input type='datetime-local' value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} required />
          </Field>
          <Field label='Votes per person'>
            <Input type='number' min={1} max={10} value={form.votesPerVoter} onChange={(e) => set('votesPerVoter', Number(e.target.value))} />
          </Field>
          {locked && <p className='text-[12px] text-muted-foreground'>People have entered already, so think twice before moving dates.</p>}
        </div>
        <div className='vx-tile flex items-center justify-between gap-3 p-5'>
          <span>
            <span className='block text-[14px] font-semibold'>Published</span>
            <span className='block text-[12.5px] text-muted-foreground'>{form.published ? 'Visible on the site' : 'Only admins can see it'}</span>
          </span>
          <Switch checked={form.published} onCheckedChange={(value) => set('published', value)} />
        </div>
        <Button type='submit' size='lg' disabled={busy}>
          {busy ? <Loader2 className='animate-spin' /> : <Check />}
          {form.id ? 'Save changes' : 'Create contest'}
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────── One contest ─────────────────────────

function ContestDetail({ id }: { id: string }) {
  const goTo = useGoTo();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['contestAdmin', id], queryFn: () => getContestAdmin(id) });
  const refresh = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['contestAdmin', id] });
    queryClient.invalidateQueries({ queryKey: ['contestsAdmin'] });
  }, [queryClient, id]);

  if (isLoading) return <Loader2 className='mx-auto mt-16 size-6 animate-spin text-muted-foreground' />;
  if (!data) return <p className='text-subtle'>That contest doesn’t exist.</p>;

  const { contest, totals } = data;
  const defaultTab = searchParams.get('tab') ?? (contest.phase === 'judging' || contest.phase === 'results' ? 'results' : 'entries');

  return (
    <div>
      <button type='button' onClick={() => goTo()} className='vx-label inline-flex cursor-pointer items-center gap-1.5 hover:text-foreground'>
        <ArrowLeft className='size-3.5' />
        Contests
      </button>
      <div className='mt-2 flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>{contest.theme}</h1>
            <PhasePill phase={contest.phase} />
          </div>
          <p className='mt-0.5 text-[13px] text-muted-foreground'>
            {contest.title} · entries {formatRange(contest.startsAt, contest.votingStartsAt)} · voting {formatRange(contest.votingStartsAt, contest.endsAt)}
          </p>
        </div>
        <Button asChild variant='neutral' size='sm'>
          <Link href={`/contest/${contest.slug}`} target='_blank'>
            <ExternalLink />
            View page
          </Link>
        </Button>
      </div>

      <div className='mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <Stat label='Entries' value={data.entries.filter((entry) => entry.status === 'active').length} />
        <Stat label='Votes counted' value={totals.votes} />
        <Stat label='Voters' value={totals.voters} />
        <Stat
          label='Flagged voters'
          value={totals.flaggedVoters}
          tone={totals.flaggedVoters ? 'warn' : undefined}
          note={totals.voided ? `${totals.voided} votes voided` : undefined}
        />
      </div>

      <Tabs defaultValue={defaultTab} className='mt-6'>
        <TabsList>
          <TabsTrigger value='entries'>Standings</TabsTrigger>
          <TabsTrigger value='voters'>
            Voters
            {totals.flaggedVoters > 0 && <span className='size-1.5 rounded-full bg-[#d99a0b]' />}
          </TabsTrigger>
          <TabsTrigger value='results'>Winner</TabsTrigger>
          <TabsTrigger value='settings'>Settings</TabsTrigger>
        </TabsList>
        <TabsContent value='entries' className='mt-4'>
          <Standings data={data} onChange={refresh} />
        </TabsContent>
        <TabsContent value='voters' className='mt-4'>
          <Voters data={data} onChange={refresh} />
        </TabsContent>
        <TabsContent value='results' className='mt-4'>
          <Results data={data} onChange={refresh} />
        </TabsContent>
        <TabsContent value='settings' className='mt-4'>
          <ContestForm
            key={contest.updatedAt.toString()}
            initial={{ ...contest, id: contest.id }}
            locked={data.entries.length > 0}
            onSaved={refresh}
          />
          <DeleteContest id={contest.id} hasEntries={data.entries.length > 0} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: number; note?: string; tone?: 'warn' }) {
  return (
    <div className='vx-tile p-4'>
      <span className='vx-label'>{label}</span>
      <span className={cn('mt-1 block text-[24px] font-semibold tabular-nums tracking-[-0.03em]', tone === 'warn' && 'text-[#b07c00] dark:text-[#f2c14e]')}>
        {value.toLocaleString()}
      </span>
      {note && <span className='block text-[12px] text-muted-foreground'>{note}</span>}
    </div>
  );
}

function DeleteContest({ id, hasEntries }: { id: string; hasEntries: boolean }) {
  const goTo = useGoTo();
  const queryClient = useQueryClient();
  if (hasEntries) return null;
  return (
    <Button
      variant='ghost'
      className='mt-6 text-bad hover:text-bad'
      onClick={async () => {
        if (!confirm('Delete this contest?')) return;
        const result = await deleteContest(id);
        if (!result.success) return toast.error(result.message);
        queryClient.invalidateQueries({ queryKey: ['contestsAdmin'] });
        toast('Contest deleted');
        goTo();
      }}
    >
      <Trash2 />
      Delete contest
    </Button>
  );
}

function Designer({ user, sub }: { user: { name: string; image: string | null; userNumber: string }; sub?: React.ReactNode }) {
  return (
    <span className='flex min-w-0 items-center gap-2.5'>
      <Avatar className='size-7'>
        {user.image && <AvatarImage src={user.image} alt='' className='object-cover' />}
        <AvatarFallback className='text-[10px]'>{initials(user.name)}</AvatarFallback>
      </Avatar>
      <span className='min-w-0'>
        <Link href={`/profile/${user.userNumber}`} target='_blank' className='block truncate text-[13.5px] font-medium hover:underline'>
          {user.name}
        </Link>
        {sub && <span className='block truncate text-[12px] text-muted-foreground'>{sub}</span>}
      </span>
    </span>
  );
}

// ───────────────────────── Standings ─────────────────────────

function Standings({ data, onChange }: { data: ContestAdminView; onChange: () => void }) {
  const { contest, entries } = data;
  const top = Math.max(1, ...entries.map((entry) => entry.votes));

  async function run(action: Promise<{ success: boolean; message?: string }>, done: string) {
    const result = await action;
    if (!result.success) toast.error(result.message ?? 'Something went wrong.');
    else toast.success(done);
    onChange();
  }

  if (!entries.length) {
    return <p className='vx-tile p-10 text-center text-[14px] text-muted-foreground'>No entries yet.</p>;
  }

  return (
    <div className='vx-tile divide-y divide-line overflow-hidden'>
      {entries.map((entry) => {
        const out = entry.status === 'disqualified';
        const winner = contest.winnerEntryId === entry.id;
        return (
          <div key={entry.id} className={cn('flex items-center gap-4 px-4 py-3', out && 'bg-bad-soft/40')}>
            <span className={cn('w-7 shrink-0 text-center text-[15px] font-semibold tabular-nums', out ? 'text-muted-foreground' : entry.rank === 1 && 'text-[#b07c00] dark:text-[#f2c14e]')}>
              {out ? '–' : entry.rank}
            </span>
            <span className={cn('flag-stage grid h-[52px] w-[76px] shrink-0 place-items-center rounded-[9px] bg-stage', out && 'opacity-40')}>
              <FlagImage src={entry.image} alt='' maxHeight={38} area={60 * 38} />
            </span>
            <span className='min-w-0 flex-1'>
              <span className='flex items-center gap-2'>
                <span className={cn('truncate text-[14.5px] font-semibold', out && 'line-through decoration-1')}>{entry.title}</span>
                {winner && (
                  <span className='inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-[rgb(217_154_11/0.14)] px-2 text-[11px] font-semibold text-[#9a6a00] dark:text-[#f2c14e]'>
                    <Trophy className='size-3' />
                    Winner
                  </span>
                )}
                {entry.flagId && (
                  <span className='inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-good-soft px-2 text-[11px] font-semibold text-good'>On Browse</span>
                )}
              </span>
              <span className='mt-0.5 block'>
                <Designer user={entry.designer} sub={out ? `Disqualified${entry.statusReason ? `: ${entry.statusReason}` : ''}` : entry.designer.email} />
              </span>
            </span>
            <span className='hidden w-[220px] shrink-0 md:block'>
              <span className='flex h-2 overflow-hidden rounded-full bg-foreground/[0.07]'>
                <span className='bg-main' style={{ width: `${((entry.votes - entry.flaggedVotes) / top) * 100}%` }} />
                <span className='bg-[#d99a0b]' style={{ width: `${(entry.flaggedVotes / top) * 100}%` }} />
              </span>
              {(entry.flaggedVotes > 0 || entry.voidedVotes > 0) && (
                <span className='mt-1 block text-[11.5px] text-muted-foreground'>
                  {entry.flaggedVotes > 0 && <span className='text-[#9a6a00] dark:text-[#f2c14e]'>{entry.flaggedVotes} from flagged voters</span>}
                  {entry.flaggedVotes > 0 && entry.voidedVotes > 0 && ' · '}
                  {entry.voidedVotes > 0 && `${entry.voidedVotes} voided`}
                </span>
              )}
            </span>
            <span className='w-14 shrink-0 text-right'>
              <span className='block text-[18px] font-semibold tabular-nums'>{entry.votes}</span>
              <span className='block text-[11px] text-muted-foreground'>votes</span>
            </span>
            <EntryMenu
              entry={entry}
              winner={winner}
              onWinner={() => run(setContestWinner(contest.id, entry.id), `${entry.title} is the winner. Announce it from the Winner tab.`)}
              onStatus={(status) => {
                const reason = status === 'disqualified' ? prompt('Why is it disqualified? Only admins see this.') : '';
                if (reason === null) return;
                run(setEntryStatus(entry.id, status, reason), status === 'disqualified' ? 'Entry disqualified' : 'Entry reinstated');
              }}
              onPublish={() => run(publishContestEntries(contest.id, [entry.id]), 'Published to Browse')}
            />
          </div>
        );
      })}
    </div>
  );
}

function EntryMenu({
  entry,
  winner,
  onWinner,
  onStatus,
  onPublish,
}: {
  entry: AdminEntry;
  winner: boolean;
  onWinner: () => void;
  onStatus: (status: 'active' | 'disqualified') => void;
  onPublish: () => void;
}) {
  const out = entry.status === 'disqualified';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon-sm' aria-label={`Actions for ${entry.title}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem asChild>
          <a href={entry.image} target='_blank' rel='noreferrer'>
            <Eye />
            Open image
          </a>
        </DropdownMenuItem>
        {!out && !winner && (
          <DropdownMenuItem onSelect={onWinner}>
            <Trophy />
            Make winner
          </DropdownMenuItem>
        )}
        {!out && !entry.flagId && (
          <DropdownMenuItem onSelect={onPublish}>
            <Flag />
            Publish to Browse
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {out ? (
          <DropdownMenuItem onSelect={() => onStatus('active')}>
            <Undo />
            Reinstate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onStatus('disqualified')} className='text-bad focus:text-bad'>
            <EyeSlash />
            Disqualify
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ───────────────────────── Voters ─────────────────────────

type VoterFilter = 'all' | 'flagged' | VoterSignal;

function Voters({ data, onChange }: { data: ContestAdminView; onChange: () => void }) {
  const [filter, setFilter] = React.useState<VoterFilter>(data.totals.flaggedVoters ? 'flagged' : 'all');
  const [busy, setBusy] = React.useState(false);
  const entries = new Map(data.entries.map((entry) => [entry.id, entry]));
  const shown = data.voters.filter((voter) =>
    filter === 'all' ? true : filter === 'flagged' ? voter.signals.length > 0 : voter.signals.includes(filter),
  );
  const counts = (signal: VoterSignal) => data.voters.filter((voter) => voter.signals.includes(signal)).length;
  const liveVotes = shown.flatMap((voter) => voter.votes.filter((vote) => !vote.voidedAt).map((vote) => vote.id));

  async function voidAll(voteIds: string[], what: string) {
    const reason = prompt(`Void ${voteIds.length} ${voteIds.length === 1 ? 'vote' : 'votes'}? Add a note for yourself (optional).`, what);
    if (reason === null) return;
    setBusy(true);
    const result = await voidVotes(voteIds, reason);
    setBusy(false);
    if (!result.success) toast.error(result.message);
    else toast.success(`Voided ${result.count} ${result.count === 1 ? 'vote' : 'votes'}`);
    onChange();
  }

  async function restore(voteIds: string[]) {
    const result = await restoreVotes(voteIds);
    if (!result.success) toast.error(result.message);
    else toast.success(`Restored ${result.count} ${result.count === 1 ? 'vote' : 'votes'}`);
    onChange();
  }

  if (!data.voters.length) return <p className='vx-tile p-10 text-center text-[14px] text-muted-foreground'>Nobody has voted yet.</p>;

  const chips: { value: VoterFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Everyone', count: data.voters.length },
    { value: 'flagged', label: 'Flagged', count: data.totals.flaggedVoters },
    ...SIGNAL_ORDER.map((signal) => ({ value: signal, label: SIGNALS[signal].label, count: counts(signal) })),
  ];

  return (
    <div>
      <div className='flex flex-wrap items-center gap-2'>
        {chips.map((chip) => (
          <button
            key={chip.value}
            type='button'
            onClick={() => setFilter(chip.value)}
            disabled={chip.count === 0 && chip.value !== 'all'}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors disabled:cursor-default disabled:opacity-40',
              filter === chip.value ? 'bg-foreground text-background' : 'vx-key text-subtle hover:text-foreground',
            )}
          >
            {chip.label}
            <span className='tabular-nums opacity-60'>{chip.count}</span>
          </button>
        ))}
        {filter !== 'all' && liveVotes.length > 0 && (
          <Button size='sm' variant='danger' className='ml-auto' disabled={busy} onClick={() => voidAll(liveVotes, filter === 'flagged' ? 'Flagged voter' : SIGNALS[filter as VoterSignal].label)}>
            {busy ? <Loader2 className='animate-spin' /> : <EyeSlash />}
            Void {liveVotes.length} {liveVotes.length === 1 ? 'vote' : 'votes'} shown
          </Button>
        )}
      </div>

      <div className='vx-tile mt-4 divide-y divide-line overflow-hidden'>
        {shown.length === 0 && <p className='p-8 text-center text-[13.5px] text-muted-foreground'>No voters match.</p>}
        {shown.map((voter) => (
          <VoterRow
            key={voter.id}
            voter={voter}
            entries={entries}
            onVoid={(ids) => voidAll(ids, 'Removed by admin')}
            onRestore={restore}
          />
        ))}
      </div>
      <p className='mt-3 text-[12px] text-muted-foreground'>
        Networks are compared by a salted hash; no IP addresses are stored. Voided votes stop counting, and the voter can’t cast them again.
      </p>
    </div>
  );
}

function VoterRow({
  voter,
  entries,
  onVoid,
  onRestore,
}: {
  voter: AdminVoter;
  entries: Map<string, AdminEntry>;
  onVoid: (voteIds: string[]) => void;
  onRestore: (voteIds: string[]) => void;
}) {
  const live = voter.votes.filter((vote) => !vote.voidedAt);
  const voided = voter.votes.filter((vote) => vote.voidedAt);
  return (
    <div className='flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center'>
      <div className='min-w-0 md:w-[260px] md:shrink-0'>
        <Designer user={voter} sub={`${voter.email} · joined ${formatContestDate(voter.joinedAt)}`} />
      </div>
      <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
        {SIGNAL_ORDER.filter((signal) => voter.signals.includes(signal)).map((signal) => (
          <span
            key={signal}
            title={SIGNALS[signal].hint}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium',
              signal === 'entrant-network' ? 'bg-bad-soft text-bad' : 'bg-[rgb(217_154_11/0.14)] text-[#9a6a00] dark:text-[#f2c14e]',
            )}
          >
            <AlertTriangle className='size-3' />
            {SIGNALS[signal].label}
            {signal === 'shared-network' && ` (${voter.sharedWith + 1})`}
          </span>
        ))}
        {voter.signals.length === 0 && <span className='inline-flex h-6 items-center gap-1 text-[12px] text-muted-foreground'><CheckCircle className='size-3.5 text-good' /> Looks fine</span>}
      </div>
      <div className='flex shrink-0 items-center gap-1.5'>
        {voter.votes.map((vote) => {
          const entry = entries.get(vote.entryId);
          return (
            <button
              key={vote.id}
              type='button'
              title={`${entry?.title ?? 'Entry'}${vote.voidedAt ? ` · voided${vote.voidReason ? `: ${vote.voidReason}` : ''} (click to restore)` : ' · click to void'}`}
              onClick={() => (vote.voidedAt ? onRestore([vote.id]) : onVoid([vote.id]))}
              className={cn(
                'flag-stage relative grid h-[30px] w-[44px] cursor-pointer place-items-center rounded-[6px] bg-stage transition-opacity hover:ring-2 hover:ring-ring',
                vote.voidedAt && 'opacity-35',
              )}
            >
              {entry && <FlagImage src={entry.image} alt='' maxHeight={22} area={34 * 22} />}
              {vote.voidedAt && <span className='absolute inset-x-1 top-1/2 h-[1.5px] -rotate-[20deg] bg-bad' />}
            </button>
          );
        })}
      </div>
      <div className='w-[110px] shrink-0 text-right'>
        {live.length > 0 ? (
          <Button size='sm' variant='ghost' className='text-bad hover:text-bad' onClick={() => onVoid(live.map((vote) => vote.id))}>
            <EyeSlash />
            Void all
          </Button>
        ) : (
          voided.length > 0 && (
            <Button size='sm' variant='ghost' onClick={() => onRestore(voided.map((vote) => vote.id))}>
              <Undo />
              Restore
            </Button>
          )
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Winner ─────────────────────────

function Results({ data, onChange }: { data: ContestAdminView; onChange: () => void }) {
  const { contest, entries } = data;
  const active = entries.filter((entry) => entry.status === 'active');
  const winner = entries.find((entry) => entry.id === contest.winnerEntryId);
  const leader = active[0];
  const tied = active.filter((entry) => entry.rank === 1).length > 1;
  const ended = new Date() >= contest.endsAt;
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(key: string, action: () => Promise<{ success: boolean; message?: string }>, done: string) {
    setBusy(key);
    const result = await action();
    setBusy(null);
    if (!result.success) toast.error(result.message ?? 'Something went wrong.');
    else toast.success(done);
    onChange();
  }

  const unpublished = active.filter((entry) => !entry.flagId).map((entry) => entry.id);

  return (
    <div className='grid gap-4 lg:grid-cols-[1.3fr_1fr]'>
      <section className='vx-tile p-5 sm:p-6'>
        <Step n={1} title='Pick the winner' done={Boolean(winner)} />
        {winner ? (
          <div className='mt-4 flex items-center gap-4 rounded-[14px] bg-[rgb(217_154_11/0.08)] p-3 shadow-[inset_0_0_0_1px_rgb(217_154_11/0.3)]'>
            <span className='flag-stage grid h-[72px] w-[104px] shrink-0 place-items-center rounded-[10px] bg-stage'>
              <FlagImage src={winner.image} alt='' maxHeight={54} area={86 * 54} />
            </span>
            <span className='min-w-0 flex-1'>
              <span className='block truncate text-[16px] font-semibold'>{winner.title}</span>
              <Designer user={winner.designer} sub={`${winner.votes} votes · rank ${winner.rank}`} />
            </span>
            <Button size='sm' variant='ghost' onClick={() => run('clear', () => setContestWinner(contest.id, null), 'Winner cleared')}>
              Change
            </Button>
          </div>
        ) : leader ? (
          <div className='mt-4'>
            <p className='text-[13.5px] text-subtle'>
              {tied
                ? 'It’s a tie at the top. Pick one of the tied entries.'
                : ended
                  ? `${leader.title} has the most counted votes.`
                  : `Voting is still open. ${leader.title} leads right now.`}
            </p>
            <div className='mt-3 grid gap-2'>
              {active.slice(0, tied ? active.filter((entry) => entry.rank === 1).length : 3).map((entry) => (
                <div key={entry.id} className='flex items-center gap-3 rounded-[12px] p-2 shadow-[inset_0_0_0_1px_var(--line)]'>
                  <span className='w-6 text-center text-[13px] font-semibold tabular-nums text-muted-foreground'>{entry.rank}</span>
                  <span className='flag-stage grid h-[40px] w-[58px] shrink-0 place-items-center rounded-[8px] bg-stage'>
                    <FlagImage src={entry.image} alt='' maxHeight={30} area={46 * 30} />
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-[14px] font-medium'>{entry.title}</span>
                    <span className='block text-[12px] text-muted-foreground'>
                      {entry.votes} votes{entry.flaggedVotes > 0 && ` · ${entry.flaggedVotes} flagged`}
                    </span>
                  </span>
                  <Button size='sm' variant={entry.rank === 1 ? 'default' : 'neutral'} disabled={busy !== null} onClick={() => run(`win-${entry.id}`, () => setContestWinner(contest.id, entry.id), `${entry.title} picked`)}>
                    <Trophy />
                    Make winner
                  </Button>
                </div>
              ))}
            </div>
            <p className='mt-3 text-[12px] text-muted-foreground'>Any entry can win; use Standings to pick one further down.</p>
          </div>
        ) : (
          <p className='mt-4 text-[13.5px] text-muted-foreground'>No entries in the running.</p>
        )}
      </section>

      <div className='flex flex-col gap-4'>
        <section className='vx-tile p-5'>
          <Step n={2} title='Announce' done={Boolean(contest.announcedAt)} />
          <p className='mt-2 text-[13px] text-subtle'>
            {contest.announcedAt
              ? `Announced ${formatContestDate(contest.announcedAt, true)}. The contest page shows the winner and every designer’s name. Vote counts are never shown.`
              : !ended
                ? `You can announce once voting closes on ${formatContestDate(contest.endsAt, true)}.`
                : 'Shows the winner and reveals every designer. Vote counts stay private.'}
          </p>
          {contest.announcedAt ? (
            <Button variant='neutral' size='sm' className='mt-3' disabled={busy !== null} onClick={() => run('unannounce', () => announceContest(contest.id, false), 'Winner hidden again')}>
              <EyeSlash />
              Hide winner
            </Button>
          ) : (
            <Button size='sm' className='mt-3' disabled={!winner || !ended || busy !== null} onClick={() => run('announce', () => announceContest(contest.id, true), 'Winner announced')}>
              {busy === 'announce' ? <Loader2 className='animate-spin' /> : <Sparkles />}
              Announce winner
            </Button>
          )}
        </section>

        <section className='vx-tile p-5'>
          <Step n={3} title='Put it on Browse' done={Boolean(winner?.flagId)} />
          <p className='mt-2 text-[13px] text-subtle'>Adds entries as flags credited to their designers, tagged custom and design contest.</p>
          <div className='mt-3 flex flex-wrap gap-2'>
            <Button size='sm' disabled={!winner || Boolean(winner.flagId) || busy !== null} onClick={() => run('pub-winner', () => publishContestEntries(contest.id, [winner!.id]), 'Winner published to Browse')}>
              {busy === 'pub-winner' ? <Loader2 className='animate-spin' /> : <Flag />}
              Publish winner
            </Button>
            <Button size='sm' variant='neutral' disabled={!unpublished.length || busy !== null} onClick={() => run('pub-all', () => publishContestEntries(contest.id, unpublished), 'Entries published to Browse')}>
              {busy === 'pub-all' ? <Loader2 className='animate-spin' /> : <Users />}
              Publish all {unpublished.length > 0 && `(${unpublished.length})`}
            </Button>
          </div>
        </section>

        <section className='vx-tile p-5'>
          <Step n={4} title='Fly it as flag of the day' />
          <p className='mt-2 text-[13px] text-subtle'>Replaces today’s flag of the day with the winner.</p>
          <Button size='sm' variant='neutral' className='mt-3' disabled={!winner?.flagId || busy !== null} onClick={() => run('fotd', () => featureContestWinner(contest.id), 'The winner is flag of the day')}>
            <Sparkles />
            Make flag of the day
          </Button>
        </section>
      </div>
    </div>
  );
}

function Step({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <div className='flex items-center gap-2.5'>
      <span className={cn('grid size-6 place-items-center rounded-full text-[12px] font-semibold', done ? 'bg-good text-white' : 'bg-foreground/[0.08] text-subtle')}>
        {done ? <Check className='size-3.5' /> : n}
      </span>
      <h2 className='text-[15px] font-semibold'>{title}</h2>
    </div>
  );
}
