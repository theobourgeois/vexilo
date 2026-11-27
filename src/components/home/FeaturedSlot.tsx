import Link from 'next/link';
import type { getCurrentContest } from '@/actions/contests';
import FlagImage from '@/components/FlagImage';
import { Calendar, CheckCircle, Clock, Flag, Sun, Trophy } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { CONTEST_ART, timeLeft } from '@/lib/contest';
import { bandGradient, type FlagBand } from '@/lib/flag-band';
import { cn } from '@/lib/utils';

type Contest = NonNullable<Awaited<ReturnType<typeof getCurrentContest>>>;
type Fotd = { name: string; image: string; description: string | null; tags: string[] };

const WINNER_DAYS = 7;
const OPEN_BAND: FlagBand = { from: 'hsl(222 58% 36%)', to: 'hsl(222 60% 15%)' };
const VOTING_BAND: FlagBand = { from: 'hsl(262 38% 34%)', to: 'hsl(262 40% 14%)' };
const WINNER_BAND: FlagBand = { from: 'hsl(38 62% 34%)', to: 'hsl(28 55% 14%)' };

/** Which thing gets the big slot: a running contest, a fresh winner, or else the flag of the day. */
export function featuredKind(contest: Contest | null): 'open' | 'voting' | 'winner' | 'fotd' {
  if (contest?.phase === 'open') return 'open';
  if (contest?.phase === 'voting') return 'voting';
  if (
    contest?.phase === 'results' &&
    contest.winnerImage &&
    contest.announcedAt &&
    Date.now() - contest.announcedAt.getTime() < WINNER_DAYS * 24 * 60 * 60 * 1000
  )
    return 'winner';
  return 'fotd';
}

/**
 * The one featured slot on the home page. No carousel: it shows the most important live thing.
 * Dark band with the art on the right; `.flag-band` turns buttons and text light.
 */
export default function FeaturedSlot({
  contest,
  fotd,
  fotdBand,
  signedIn,
  votesUsed,
  tall,
}: {
  contest: Contest | null;
  fotd: Fotd | null;
  fotdBand: FlagBand;
  signedIn: boolean;
  votesUsed: number | null;
  tall?: boolean;
}) {
  const kind = featuredKind(contest);
  const contestHref = contest ? `/contest/${contest.slug}` : '/contest';

  if (kind === 'fotd' || !contest) {
    if (!fotd) return null;
    const href = `/flag/${encodeURIComponent(fotd.name)}`;
    return (
      <Band band={fotdBand} tall={tall}>
        <Copy
          eyebrow={
            <>
              <Sun className='size-3.5' /> Flag of the day · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </>
          }
          title={fotd.name}
          body={fotd.description ? firstSentence(fotd.description) : null}
          meta={fotd.tags.slice(0, 2).map((tag) => ({ icon: <Flag />, text: tag }))}
          ctas={
            <>
              <Button asChild>
                <Link href={href}>Read more</Link>
              </Button>
              <Button asChild variant='neutral'>
                <Link href='/play/unfurl'>Play Unfurl</Link>
              </Button>
            </>
          }
        />
        <Art>
          <div className='flag-band-art grid h-full place-items-center px-6'>
            <FlagImage src={fotd.image} alt={fotd.name} maxHeight={190} area={300 * 200} />
          </div>
        </Art>
      </Band>
    );
  }

  if (kind === 'winner') {
    return (
      <Band band={WINNER_BAND} tall={tall}>
        <Copy
          eyebrow={
            <>
              <Trophy className='size-3.5' /> {contest.title} · Winner
            </>
          }
          title={contest.winnerTitle ?? 'The winner'}
          body={contest.winnerDesigner ? `By @${contest.winnerDesigner}. Chosen from ${contest.entryCount.toLocaleString()} entries.` : null}
          ctas={
            <Button asChild variant='neutral'>
              <Link href={contestHref}>See the results</Link>
            </Button>
          }
        />
        <Art>
          <div className='grid h-full place-items-center px-6'>
            <FlagImage src={contest.winnerImage!} alt={contest.winnerTitle ?? 'Winning flag'} maxHeight={190} area={300 * 200} />
          </div>
        </Art>
      </Band>
    );
  }

  if (kind === 'voting') {
    return (
      <Band band={VOTING_BAND} tall={tall}>
        <Copy
          eyebrow={
            <>
              <Dot className='bg-[#fbbf24] shadow-[0_0_0_3px_rgb(251_191_36/0.25)]' /> Contest · Voting
            </>
          }
          title={contest.title}
          body={`${contest.entryCount.toLocaleString()} entries. Pick your ${contest.votesPerVoter} favourite entries.`}
          meta={[
            { icon: <Clock />, text: `Closes in ${timeLeft(contest.endsAt)}` },
            ...(votesUsed !== null ? [{ icon: <CheckCircle />, text: `${votesUsed} of ${contest.votesPerVoter} votes used` }] : []),
          ]}
          ctas={
            <>
              <Button asChild>
                <Link href={contestHref}>Vote</Link>
              </Button>
              <Button asChild variant='neutral'>
                <Link href={contestHref}>Rules</Link>
              </Button>
            </>
          }
        />
        <Art>{contest.previews.length > 0 ? <Fan images={contest.previews} /> : <ContestArt slug={contest.slug} />}</Art>
      </Band>
    );
  }

  // Open for entries. Entries stay hidden until voting, so the art is the contest's own.
  const enterHref = signedIn ? contestHref : `/signin?callbackUrl=${encodeURIComponent(contestHref)}`;
  return (
    <Band band={OPEN_BAND} tall={tall}>
      <Copy
        eyebrow={
          <>
            <Dot className='bg-[#4ade80] shadow-[0_0_0_3px_rgb(74_222_128/0.25)]' /> Contest · Open for entries
          </>
        }
        title={contest.title}
        body={contest.theme}
        meta={[
          { icon: <Flag />, text: `${contest.entryCount.toLocaleString()} ${contest.entryCount === 1 ? 'entry' : 'entries'}` },
          { icon: <Clock />, text: `${timeLeft(contest.votingStartsAt)} left` },
        ]}
        ctas={
          <>
            <Button asChild>
              <Link href={enterHref}>Enter</Link>
            </Button>
            <Button asChild variant='neutral'>
              <Link href={contestHref}>
                <Calendar /> Details
              </Link>
            </Button>
          </>
        }
      />
      <Art>
        <ContestArt slug={contest.slug} />
      </Art>
    </Band>
  );
}

function Band({ band, tall, children }: { band: FlagBand; tall?: boolean; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        'flag-band relative isolate flex flex-col overflow-hidden rounded-[22px] sm:flex-row',
        tall ? 'h-full min-h-[350px]' : 'min-h-[350px]',
      )}
      style={{ backgroundImage: bandGradient(band) }}
    >
      {children}
    </section>
  );
}

function Copy({
  eyebrow,
  title,
  body,
  meta = [],
  ctas,
}: {
  eyebrow: React.ReactNode;
  title: string;
  body: string | null;
  meta?: { icon: React.ReactNode; text: string }[];
  ctas: React.ReactNode;
}) {
  return (
    <div className='relative z-[2] flex flex-col px-7 pb-6 pt-[26px] sm:max-w-[300px] sm:flex-1'>
      <span className='inline-flex h-[26px] items-center gap-[7px] self-start rounded-full bg-white/[0.14] px-[11px] text-[12px] font-semibold'>
        {eyebrow}
      </span>
      <h2 className='mt-4 text-[30px] font-semibold leading-[1.1] tracking-[-0.035em]'>{title}</h2>
      {body && <p className='mt-2 text-[14px] text-subtle'>{body}</p>}
      {meta.length > 0 && (
        <div className='mt-3.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-muted-foreground [&_svg]:size-3.5'>
          {meta.map((item) => (
            <span key={item.text} className='inline-flex items-center gap-1.5'>
              {item.icon}
              {item.text}
            </span>
          ))}
        </div>
      )}
      <div className='mt-auto flex flex-wrap gap-2 pt-[22px]'>{ctas}</div>
    </div>
  );
}

function Art({ children }: { children: React.ReactNode }) {
  return <div className='relative h-[220px] shrink-0 sm:h-auto sm:flex-1'>{children}</div>;
}

function Dot({ className }: { className: string }) {
  return <span className={cn('size-[7px] rounded-full', className)} />;
}

/** Three entries fanned out like cards on a table. */
function Fan({ images }: { images: string[] }) {
  const spots = ['left-[6%] top-[34%] -rotate-[9deg] z-[1]', 'left-[26%] top-[12%] rotate-[3deg] z-[3]', 'left-[44%] top-[40%] rotate-[11deg] z-[2]'];
  return (
    <div className='absolute inset-0'>
      {images.slice(0, 3).map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=''
          className={cn('absolute w-[46%] max-w-[190px] rounded-[3px] shadow-[0_0_0_1px_rgb(255_255_255/0.2),0_18px_30px_rgb(0_0_0/0.4)]', spots[i])}
        />
      ))}
    </div>
  );
}

function ContestArt({ slug }: { slug: string }) {
  const art = CONTEST_ART[slug];
  if (!art) return null;
  return (
    <div className='absolute inset-0 grid place-items-center p-6'>
      {/* The art's bottom band repeats the theme; crop it like the contest page does. */}
      <div className='aspect-[3/2] w-full max-w-[320px] overflow-hidden rounded-[10px] shadow-[0_18px_30px_rgb(0_0_0/0.4)]'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} alt='' className='size-full object-cover object-top' />
      </div>
    </div>
  );
}

function firstSentence(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const match = clean.match(/^.{20,180}?[.!?](\s|$)/);
  const sentence = match ? match[0].trim() : clean;
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence;
}
