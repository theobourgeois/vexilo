'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { getRandomFlagsForQuiz, toggleFavoriteFlag } from '@/actions/flags';
import { toastErrorWithLogin } from '@/lib/toast-auth';
import FlagImage from '@/components/FlagImage';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import {
  ArrowUpRight,
  CheckCircle,
  Fire,
  Flag as FlagIcon,
  Heart,
  SquaresFour,
  Target,
  Trophy,
  XCircle,
} from '@/components/icons';
import { Stat } from '@/components/games/shared';
import { COUNTRIES, PLACES, type GameFlag } from '@/lib/games/pool';
import { cn } from '@/lib/utils';

type Mode = 'name' | 'find';
type QuizSet = 'countries' | 'us' | 'more' | 'every';

type QuizFlag = Pick<GameFlag, 'id' | 'name' | 'href' | 'image'>;

type Question = {
  answer: QuizFlag;
  options: QuizFlag[];
};

const BEST_KEY = 'vexilo-quiz-best';
const LETTERS = ['A', 'B', 'C', 'D'];

/** Wrong options come from the answer's own group, so a US state is never up against three countries. */
const GROUPS = {
  countries: COUNTRIES,
  us: PLACES.filter((f) => f.set === 'us-state'),
  more: PLACES.filter((f) => f.set !== 'us-state'),
};
const groupOf = (flag: GameFlag) => (flag.set === 'country' ? GROUPS.countries : flag.set === 'us-state' ? GROUPS.us : GROUPS.more);
const SETS: Record<Exclude<QuizSet, 'every'>, GameFlag[]> = GROUPS;

const SET_OPTIONS: { value: QuizSet; label: string }[] = [
  { value: 'countries', label: 'Countries' },
  { value: 'us', label: 'US states' },
  { value: 'more', label: 'More places' },
  { value: 'every', label: 'Every flag' },
];

const pickFrom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function makeQuestion(set: Exclude<QuizSet, 'every'>, recent: string[]): Question {
  const pool = SETS[set];
  const fresh = pool.filter((f) => !recent.includes(f.id));
  const answer = pickFrom(fresh.length ? fresh : pool);
  const picked = new Map([[answer.id, answer]]);
  const group = groupOf(answer);
  while (picked.size < 4) {
    const flag = pickFrom(group);
    picked.set(flag.id, flag);
  }
  return { answer, options: shuffle([...picked.values()]) };
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** "Every flag" draws from the whole library, a batch at a time from the server. */
const EVERY_REFILL_AT = 16;

/** Four flags off the front of the bank with different names, or null if it runs dry. */
function takeQuestion(bank: QuizFlag[]): Question | null {
  const options: QuizFlag[] = [];
  const names = new Set<string>();
  const skipped: QuizFlag[] = [];
  while (bank.length && options.length < 4) {
    const flag = bank.shift()!;
    const key = flag.name.trim().toLowerCase();
    if (names.has(key)) skipped.push(flag);
    else {
      names.add(key);
      options.push(flag);
    }
  }
  bank.unshift(...skipped);
  if (options.length < 4) {
    bank.unshift(...options);
    return null;
  }
  return { answer: pickFrom(options), options };
}

export default function FlagQuiz() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [mode, setMode] = React.useState<Mode>('name');
  const [set, setSet] = React.useState<QuizSet>('countries');
  const recent = React.useRef<string[]>([]);
  const bank = React.useRef<QuizFlag[]>([]);
  const refilling = React.useRef<Promise<boolean> | null>(null);
  /** Bumped by every next(), so a slow "Every flag" load can't overwrite a newer question. */
  const turn = React.useRef(0);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [question, setQuestion] = React.useState<Question | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [score, setScore] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [best, setBest] = React.useState(0);
  const [history, setHistory] = React.useState<boolean[]>([]);
  const [isFavorite, setIsFavorite] = React.useState(false);

  const refill = React.useCallback(() => {
    refilling.current ??= getRandomFlagsForQuiz()
      .then((rows) => {
        const have = new Set(bank.current.map((f) => f.id));
        const fresh = rows
          .filter((row) => row.name && row.image && !have.has(row.id))
          .map((row) => ({ ...row, href: `/flag/${encodeURIComponent(row.name)}` }));
        bank.current.push(...shuffle(fresh));
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refilling.current = null;
      });
    return refilling.current;
  }, []);

  const next = React.useCallback(
    (from: QuizSet = set) => {
      const ticket = ++turn.current;
      setSelected(null);
      setIsFavorite(false);
      setLoadFailed(false);
      if (from !== 'every') {
        const question = makeQuestion(from, recent.current);
        recent.current = [question.answer.id, ...recent.current].slice(0, Math.floor(SETS[from].length / 2));
        setQuestion(question);
        return;
      }
      const ready = takeQuestion(bank.current);
      if (bank.current.length < EVERY_REFILL_AT) void refill();
      if (ready) {
        setQuestion(ready);
        return;
      }
      setQuestion(null);
      void (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const ok = await refill();
          if (ticket !== turn.current) return;
          const question = ok ? takeQuestion(bank.current) : null;
          if (question) {
            setQuestion(question);
            return;
          }
        }
        setLoadFailed(true);
      })();
    },
    [set, refill],
  );

  React.useEffect(() => {
    // /play/quiz?set=every opens straight into a set, so a mode can be shared.
    const linked = new URLSearchParams(window.location.search).get('set');
    const start = SET_OPTIONS.some((o) => o.value === linked) ? (linked as QuizSet) : set;
    setSet(start);
    next(start);
    // On phones the set picker scrolls sideways; bring a linked set into view.
    requestAnimationFrame(() =>
      document
        .querySelector(`[aria-label='Which flags'] [aria-checked='true']`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
    );
    setBest(Number(localStorage.getItem(BEST_KEY) || 0));
    // Only the first question; later ones come from answering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = React.useCallback(
    (id: string) => {
      if (!question || selected !== null) return;
      const correct = id === question.answer.id;
      setSelected(id);
      setTotal((t) => t + 1);
      setHistory((h) => [...h, correct].slice(-10));
      if (correct) {
        setScore((s) => s + 1);
        setStreak((s) => {
          const nextStreak = s + 1;
          setBest((b) => {
            if (nextStreak <= b) return b;
            localStorage.setItem(BEST_KEY, String(nextStreak));
            return nextStreak;
          });
          return nextStreak;
        });
      } else {
        setStreak(0);
      }
    },
    [question, selected],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const n = Number(e.key);
      if (question && n >= 1 && n <= 4 && selected === null) {
        answer(question.options[n - 1].id);
      } else if (e.key === 'Enter' && selected !== null) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, selected, answer, next]);

  const toggleFavorite = async () => {
    if (!session?.user) {
      toastErrorWithLogin('You must be logged in to favorite a flag');
      return;
    }
    if (!question) return;
    const previous = isFavorite;
    setIsFavorite(!previous);
    const ok = await toggleFavoriteFlag(question.answer.id);
    queryClient.invalidateQueries({ queryKey: ['flags'] });
    if (!ok) setIsFavorite(previous);
  };

  const answered = selected !== null;
  const correct = answered && selected === question?.answer.id;
  const flagHref = question?.answer.href ?? '#';

  const historyDots = (
    <div className='flex gap-[5px]' title='Last 10 answers'>
      {Array.from({ length: 10 }).map((_, i) => {
        const value = history[i];
        return (
          <i
            key={i}
            className={cn(
              'size-2 rounded-full',
              value === undefined
                ? 'shadow-[inset_0_0_0_1.5px_var(--border)]'
                : value
                  ? 'bg-good'
                  : 'bg-bad',
            )}
          />
        );
      })}
    </div>
  );

  const waiting = !question && (
    <div className='grid min-h-[120px] place-items-center text-[13.5px] text-subtle'>
      {loadFailed ? (
        <span className='inline-flex items-center gap-3'>
          Couldn’t load flags.
          <Button variant='ghost' onClick={() => next()}>
            Try again
          </Button>
        </span>
      ) : (
        'Shuffling the library…'
      )}
    </div>
  );

  const footer = answered && question && (
    <div className='mt-[18px] flex flex-wrap items-center gap-3 border-t border-line pt-[18px]'>
      <p className='min-w-0 flex-1 text-[13.5px] text-subtle'>
        <b className={cn('font-semibold', correct ? 'text-good' : 'text-bad')}>
          {correct ? 'Correct.' : 'Not quite.'}
        </b>{' '}
        {correct ? (
          <>That’s {question.answer.name}.</>
        ) : (
          <>
            The answer is <b className='font-semibold text-foreground'>{question.answer.name}</b>.
          </>
        )}
      </p>
      <Button variant='ghost' asChild>
        <Link href={flagHref}>
          View flag
          <ArrowUpRight />
        </Link>
      </Button>
      <Button onClick={() => next()}>
        Next flag
        <kbd className='rounded-md bg-white/20 px-1.5 tabular-nums text-[11px] leading-5'>↵</kbd>
      </Button>
    </div>
  );

  return (
    <div className='mx-auto max-w-[920px]'>
      <div className='flex flex-wrap items-center gap-3 pb-4 pt-7'>
        <Segmented
          aria-label='Quiz mode'
          value={mode}
          onChange={(m) => {
            setMode(m);
            next();
          }}
          options={[
            { value: 'name', label: 'Name the flag', icon: <FlagIcon /> },
            { value: 'find', label: 'Find the flag', icon: <SquaresFour /> },
          ]}
        />
        <Segmented
          aria-label='Which flags'
          className='max-w-full overflow-x-auto [scrollbar-width:none]'
          value={set}
          onChange={(s) => {
            setSet(s);
            recent.current = [];
            const url = new URL(window.location.href);
            if (s === 'countries') url.searchParams.delete('set');
            else url.searchParams.set('set', s);
            window.history.replaceState(window.history.state, '', url);
            next(s);
          }}
          options={SET_OPTIONS}
        />
        <div className='flex gap-2 lg:ml-auto'>
          <Stat icon={<Fire weight='fill' />} label='Streak' value={streak} hot={streak > 0} />
          <Stat icon={<Target />} label='Score' value={`${score}/${total}`} />
          <Stat icon={<Trophy />} label='Best' value={best} />
        </div>
      </div>

      {mode === 'name' ? (
        <section className='vx-tile overflow-hidden'>
          <div className='bg-stage relative h-[300px] [container-type:size] sm:h-[380px]'>
            <span className='vx-label absolute left-[18px] top-4'>Question {total + (answered ? 0 : 1)}</span>
            <div className='absolute right-[18px] top-[18px]'>{historyDots}</div>
            {!question && <div className='absolute inset-0 grid place-items-center'>{waiting}</div>}
            {question && (
              <div className='flag-stage absolute inset-x-8 bottom-8 top-14'>
                <FlagImage
                  key={question.answer.image}
                  src={question.answer.image}
                  alt='Mystery flag'
                  maxHeight={230}
                  area={340 * 220}
                  eager
                />
              </div>
            )}
            {answered && (
              <Button
                variant='neutral'
                size='icon'
                onClick={toggleFavorite}
                className='absolute bottom-4 right-4'
                title='Favorite this flag'
              >
                <Heart weight={isFavorite ? 'fill' : 'bold'} className={cn(isFavorite && 'text-main')} />
              </Button>
            )}
          </div>
          <div className='px-6 pb-6 pt-[22px]'>
            <h1 className='mb-4 text-lg font-semibold tracking-[-0.02em]'>Which flag is this?</h1>
            <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
              {question?.options.map((option, i) => {
                const isAnswer = option.id === question.answer.id;
                const isPicked = option.id === selected;
                return (
                  <button
                    key={option.id}
                    type='button'
                    disabled={answered}
                    onClick={() => answer(option.id)}
                    className={cn(
                      'flex h-14 cursor-pointer items-center gap-3 rounded-[13px] pl-3 pr-3.5 text-left text-[15px] font-semibold transition-[transform,opacity] disabled:cursor-default',
                      !(answered && (isAnswer || isPicked)) && 'vx-key',
                      answered && isAnswer && 'bg-good-soft shadow-[inset_0_0_0_1.5px_var(--good)]',
                      answered && isPicked && !isAnswer && 'bg-bad-soft shadow-[inset_0_0_0_1.5px_var(--bad)]',
                      answered && !isAnswer && !isPicked && 'opacity-45',
                    )}
                  >
                    <kbd
                      className={cn(
                        'grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-md tabular-nums text-[11px] font-medium',
                        !(answered && (isAnswer || isPicked)) && 'vx-key text-subtle',
                        answered && isAnswer && 'bg-good text-white',
                        answered && isPicked && !isAnswer && 'bg-bad text-white',
                      )}
                    >
                      {i + 1}
                    </kbd>
                    <span className='min-w-0 flex-1 truncate' title={option.name}>
                      {option.name}
                    </span>
                    {answered && isAnswer && <CheckCircle className='size-[18px] shrink-0 text-good' />}
                    {answered && isPicked && !isAnswer && <XCircle className='size-[18px] shrink-0 text-bad' />}
                  </button>
                );
              })}
            </div>
            {footer}
          </div>
        </section>
      ) : (
        <section className='vx-tile p-5'>
          <div className='mb-4 flex items-center gap-3'>
            <h1 className='min-w-0 flex-1 text-base font-semibold tracking-[-0.02em]'>
              Which one is <span className='text-main'>{question?.answer.name}</span>?
            </h1>
            {historyDots}
          </div>
          {waiting}
          <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
            {question?.options.map((option, i) => {
              const isAnswer = option.id === question.answer.id;
              const isPicked = option.id === selected;
              return (
                <button
                  key={option.id}
                  type='button'
                  disabled={answered}
                  onClick={() => answer(option.id)}
                  className={cn(
                    'vx-tile flex cursor-pointer flex-col transition-[transform,box-shadow,opacity] enabled:hover:shadow-tile-hover disabled:cursor-default',
                    answered && isAnswer && 'shadow-[inset_0_0_0_1.5px_var(--good),var(--sh-tile)]',
                    answered && isPicked && !isAnswer && 'shadow-[inset_0_0_0_1.5px_var(--bad),var(--sh-tile)]',
                    answered && !isAnswer && !isPicked && 'opacity-50',
                  )}
                >
                  <div className='flag-stage h-[150px] px-4'>
                    <FlagImage src={option.image} alt={`Option ${LETTERS[i]}`} maxHeight={112} area={160 * 104} eager />
                  </div>
                  <div className='flex h-10 items-center justify-center pb-2 tabular-nums text-xs'>
                    {answered && (isAnswer || isPicked) ? (
                      <span className={cn('inline-flex items-center gap-1.5 truncate px-2', isAnswer ? 'text-good' : 'text-bad')}>
                        {isAnswer ? <CheckCircle className='size-3.5 shrink-0' /> : <XCircle className='size-3.5 shrink-0' />}
                        <span className='truncate'>{option.name}</span>
                      </span>
                    ) : (
                      <kbd className='vx-key grid h-[22px] min-w-[22px] place-items-center rounded-md text-[11px] font-medium text-subtle'>
                        {i + 1}
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {footer}
        </section>
      )}
    </div>
  );
}
