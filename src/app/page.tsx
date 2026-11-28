import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getCurrentContest, getMyVoteCount } from '@/actions/contests';
import {
  getFlagOfTheDay,
  getFlags,
  getFlagsCount,
  getMostViewedFlagsThisWeek,
} from '@/actions/flags';
import CreatorRow from '@/components/community/CreatorRow';
import PostCard, { PostGridSkeleton } from '@/components/community/PostCard';
import UserAvatar from '@/components/community/UserAvatar';
import FlagCard from '@/components/FlagCard';
import FlagImage from '@/components/FlagImage';
import { ChevronRight } from '@/components/icons';
import { CardHeader, SectionHeader } from '@/components/home/CardHeader';
import FeaturedSlot, { featuredKind } from '@/components/home/FeaturedSlot';
import HomeSearch from '@/components/home/HomeSearch';
import PuzzlesCard from '@/components/home/PuzzlesCard';
import { Button } from '@/components/ui/button';
import { getServerAuthSession } from '@/lib/auth';
import { getStoredPalette } from '@/lib/flag-palette';
import { flagBand, NEUTRAL_BAND } from '@/lib/flag-band';
import {
  getFollowingPreview,
  getHomeFlagOfTheDay,
  getHomeMostRemixed,
  getHomeTags,
  getHomeTopCreators,
  getPlayedToday,
  getTrendingPosts,
  getViewerWeek,
  withViewerLikes,
} from '@/lib/home';
import { getTopCreators } from '@/lib/posts';
import { profilePath } from '@/lib/post-slug';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl('/') },
};

const today = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default async function Home() {
  const session = await getServerAuthSession();
  const viewer = session?.user?.id
    ? { id: session.user.id, username: session.user.name ?? '' }
    : null;

  const [contest, fotd, played, ency, tags] = await Promise.all([
    getCurrentContest().catch(() => null),
    loadFlagOfTheDay(),
    getPlayedToday().catch(() => ({ unfurl: 0, grid: 0 })),
    loadEncyclopediaRow(),
    getHomeTags().catch(() => []),
  ]);
  const kind = featuredKind(contest);
  const [fotdBand, votesUsed] = await Promise.all([
    kind === 'fotd' && fotd
      ? getStoredPalette({ kind: 'flag', id: fotd.id, image: fotd.image }).then(
          (colors) => (colors ? flagBand(colors) : NEUTRAL_BAND),
        )
      : NEUTRAL_BAND,
    kind === 'voting' && contest && viewer
      ? getMyVoteCount(contest.id).catch(() => null)
      : null,
  ]);
  const quizFlags = ency.flags.slice(0, 3).map((flag) => flag.image);
  const serverDate = new Date().toISOString().slice(0, 10);

  const featured = (
    <FeaturedSlot
      contest={contest}
      fotd={fotd}
      fotdBand={fotdBand}
      signedIn={!!viewer}
      votesUsed={votesUsed}
      tall={!!viewer}
    />
  );
  const puzzles = (
    <PuzzlesCard
      played={played}
      serverDate={serverDate}
      quizFlags={quizFlags}
      showStreak={!!viewer}
    />
  );
  const trending = (
    <Suspense fallback={<RowSkeleton />}>
      <Trending viewerId={viewer?.id ?? null} />
    </Suspense>
  );
  const encyclopedia = (
    <>
      <SectionHeader
        title='From the encyclopedia'
        note={ency.note}
        link={{ href: '/browse', label: 'Browse all flags' }}
      />
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {ency.flags.map((flag) => (
          <FlagCard
            key={flag.id}
            id={flag.id}
            flagName={flag.name}
            flagImage={flag.image}
            favorites={flag.favorites}
            isFavorite={flag.isFavorite}
            link={flag.link}
            index={flag.index}
            tags={flag.tags}
            description={flag.description}
            sources={flag.sources}
          />
        ))}
      </div>
    </>
  );

  if (viewer) {
    return (
      <div className='mx-auto max-w-[1312px] px-4 pb-4 md:px-8'>
        <div className='pt-8'>
          <HomeSearch compact placeholder='Search flags…' />
        </div>

        <Suspense fallback={<RowSkeleton />}>
          <Following viewerId={viewer.id} />
        </Suspense>

        <div className='mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]'>
          {featured ?? <div />}
          <div className='flex flex-col gap-4'>
            {puzzles}
            <Suspense
              fallback={<div className='vx-tile h-[150px] animate-pulse' />}
            >
              <WeekCard viewer={viewer} />
            </Suspense>
          </div>
        </div>

        {trending}
        {encyclopedia}
      </div>
    );
  }

  const flagCount = await getFlagsCount().catch(() => 0);

  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-4 md:px-8'>
      <div className='grid items-center gap-8 pt-10 lg:grid-cols-[minmax(0,1fr)_600px] lg:gap-11 lg:pt-11'>
        <div className='min-w-0'>
          <h1 className='text-[38px] font-semibold leading-[1.04] tracking-[-0.042em] sm:text-[48px]'>
            {flagCount > 0 ? `Search ${flagCount.toLocaleString()} flags` : 'Search flags'}
          </h1>
          <div className='mt-6'>
            <HomeSearch placeholder='Search by country, color or symbol' />
          </div>
          {tags.length > 0 && (
            <div className='mt-3.5 flex flex-wrap items-center gap-2'>
              <span className='vx-label mr-0.5'>Popular</span>
              {tags.slice(0, 5).map(({ tag }) => (
                <TagLink key={tag} tag={tag} />
              ))}
            </div>
          )}
        </div>
        {featured}
      </div>

      <div className='mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {puzzles}
        {kind === 'fotd' ? (
          <Suspense
            fallback={<div className='vx-tile h-[260px] animate-pulse' />}
          >
            <MostRemixedCard />
          </Suspense>
        ) : (
          fotd && <FotdCard fotd={fotd} />
        )}
        <Suspense
          fallback={<div className='vx-tile h-[260px] animate-pulse' />}
        >
          <TopCreatorsCard />
        </Suspense>
      </div>

      {trending}
      <MakerStrip />
      {encyclopedia}

      {tags.length > 5 && (
        <div className='mt-4 flex flex-wrap items-center gap-2'>
          <span className='vx-label mr-0.5'>Explore</span>
          {tags.slice(5).map(({ tag }) => (
            <TagLink key={tag} tag={tag} />
          ))}
          <Link
            href='/flags'
            className='vx-key inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-subtle hover:text-foreground'
          >
            Collections
          </Link>
        </div>
      )}
    </div>
  );
}

async function loadFlagOfTheDay() {
  const cached = await getHomeFlagOfTheDay().catch(() => null);
  if (cached) return cached;
  // Today's pick hasn't been made yet: this makes it.
  const flag = await getFlagOfTheDay().catch(() => null);
  return flag
    ? {
        id: flag.id,
        name: flag.name,
        image: flag.image,
        description: flag.description,
        tags: flag.tags,
      }
    : null;
}

/** The week's most viewed real flags; the most favorited ones when there are no views to count yet. */
async function loadEncyclopediaRow() {
  const week = await getMostViewedFlagsThisWeek(4).catch(() => []);
  if (week.length >= 4) return { flags: week, note: 'Most viewed this week' };
  const top = await getFlags(1, 4, '', 'favorites', 'desc').catch(() => []);
  return { flags: top, note: 'Most favorited' };
}

function TagLink({ tag }: { tag: string }) {
  return (
    <Link
      href={`/browse?tag=${encodeURIComponent(tag)}`}
      className='vx-key inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium capitalize text-subtle hover:text-foreground'
    >
      {tag}
    </Link>
  );
}

function RowSkeleton() {
  return (
    <div className='mt-10'>
      <div className='mb-4 h-7 w-56 animate-pulse rounded-lg bg-foreground/[0.06]' />
      <PostGridSkeleton count={4} />
    </div>
  );
}

function PostRow({
  posts,
}: {
  posts: Awaited<ReturnType<typeof withViewerLikes>>;
}) {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

async function Trending({ viewerId }: { viewerId: string | null }) {
  const { posts, range } = await getTrendingPosts().catch(() => ({
    posts: [],
    range: 'all' as const,
  }));
  if (posts.length === 0) return null;
  const withLikes = await withViewerLikes(posts, viewerId).catch(() => posts);
  return (
    <>
      <SectionHeader
        title='Trending in Community'
        note={range === 'week' ? 'Most liked this week' : 'Most liked'}
        link={{ href: '/community', label: 'See all in Community' }}
      />
      <PostRow posts={withLikes} />
    </>
  );
}

async function Following({ viewerId }: { viewerId: string }) {
  const preview = await getFollowingPreview(viewerId).catch(() => null);
  if (preview && preview.posts.length > 0) {
    return (
      <>
        <SectionHeader
          title='From people you follow'
          note={
            preview.newThisWeek > 0
              ? `${preview.newThisWeek} new this week`
              : undefined
          }
          link={{ href: '/community?sort=following', label: 'See all' }}
        />
        <PostRow posts={preview.posts} />
      </>
    );
  }
  const suggested = await getTopCreators({
    viewerId,
    range: 'all',
    limit: 4,
    excludeFollowed: true,
  }).catch(() => []);
  if (suggested.length === 0) return null;
  return (
    <>
      <SectionHeader
        title='Creators to follow'
        note={
          preview?.following
            ? 'Nothing new from people you follow'
            : 'Their designs will show up here'
        }
        link={{ href: '/leaderboard', label: 'Leaderboard' }}
      />
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {suggested.map((person) => (
          <div key={person.id} className='vx-tile overflow-hidden'>
            <Link
              href={person.showcase[0]?.path ?? profilePath(person.username)}
              className='flag-stage bg-stage grid h-[120px] place-items-center px-6 py-5'
            >
              {person.showcase[0] && (
                <FlagImage
                  src={person.showcase[0].image}
                  alt={person.showcase[0].name}
                  maxHeight={80}
                />
              )}
            </Link>
            <div className='px-4 pb-1.5 pt-1'>
              <CreatorRow
                person={person}
                detail={`${person.posts} designs · ${person.likes.toLocaleString()} likes`}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

async function WeekCard({
  viewer,
}: {
  viewer: { id: string; username: string };
}) {
  const week = await getViewerWeek(viewer.id).catch(() => null);
  if (!week) return null;
  const stats = [
    {
      value: week.likes.toLocaleString(),
      label: week.likes === 1 ? 'like' : 'likes',
    },
    {
      value: week.remixes.toLocaleString(),
      label: week.remixes === 1 ? 'remix' : 'remixes',
    },
    {
      value: week.followers > 0 ? `+${week.followers.toLocaleString()}` : '0',
      label: week.followers === 1 ? 'follower' : 'followers',
    },
  ];
  return (
    <div className='vx-tile flex flex-col overflow-hidden'>
      <CardHeader
        title='This week'
        when='your designs'
        link={
          viewer.username
            ? { href: profilePath(viewer.username), label: 'Profile' }
            : undefined
        }
      />
      <div className='grid grid-cols-3 px-[18px] py-1'>
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={i > 0 ? 'border-l border-line pl-4' : undefined}
          >
            <p className='text-[24px] font-semibold leading-[1.2] tabular-nums tracking-[-0.035em]'>
              {stat.value}
            </p>
            <p className='text-[12px] text-muted-foreground'>{stat.label}</p>
          </div>
        ))}
      </div>
      <p className='px-[18px] pb-4 pt-2.5 text-[12.5px] text-subtle'>
        {week.rank !== null ? (
          <>
            #{week.rank} among creators by likes, last 30 days ·{' '}
            <Link
              href='/leaderboard'
              className='font-medium hover:text-foreground'
            >
              Leaderboard
            </Link>
          </>
        ) : (
          <>
            Post a design to show up on the{' '}
            <Link
              href='/leaderboard'
              className='font-medium hover:text-foreground'
            >
              leaderboard
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}

function FotdCard({
  fotd,
}: {
  fotd: NonNullable<Awaited<ReturnType<typeof loadFlagOfTheDay>>>;
}) {
  const href = `/flag/${encodeURIComponent(fotd.name)}`;
  return (
    <div className='vx-tile flex flex-col overflow-hidden'>
      <CardHeader
        title='Flag of the day'
        when={today()}
        link={{ href: '/flag-of-the-day', label: 'Archive' }}
      />
      <Link href={href} className='group flex flex-1 flex-col'>
        <div className='flag-stage bg-stage mt-1 grid h-32 place-items-center px-6'>
          <FlagImage src={fotd.image} alt={fotd.name} maxHeight={92} />
        </div>
        <div className='flex items-end gap-3 px-[18px] pb-4 pt-3'>
          <div className='min-w-0 flex-1'>
            <h3 className='text-[18px] font-semibold tracking-[-0.025em]'>
              {fotd.name}
            </h3>
            {fotd.description && (
              <p className='mt-px line-clamp-1 text-[13px] text-subtle'>
                {fotd.description}
              </p>
            )}
          </div>
          <ChevronRight className='mb-1 size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
        </div>
      </Link>
    </div>
  );
}

async function MostRemixedCard() {
  const flags = await getHomeMostRemixed().catch(() => []);
  if (flags.length === 0) return <div className='hidden lg:block' />;
  return (
    <div className='vx-tile flex flex-col overflow-hidden'>
      <CardHeader
        title='Most remixed flags'
        when='in the maker'
        link={{ href: '/create', label: 'Remix one' }}
      />
      <ul className='pb-2'>
        {flags.map((flag) => (
          <li key={flag.id} className='[&+&]:border-t [&+&]:border-line'>
            <Link
              href={`/flag/${encodeURIComponent(flag.name)}`}
              className='flex items-center gap-3 px-[18px] py-2 hover:bg-foreground/[0.03]'
            >
              <span className='grid h-[30px] w-11 shrink-0 place-items-center'>
                <FlagImage src={flag.image} alt='' maxHeight={28} fixed />
              </span>
              <span className='min-w-0 flex-1 truncate text-[13.5px] font-medium'>
                {flag.name}
              </span>
              <span className='shrink-0 text-[12px] tabular-nums text-muted-foreground'>
                {flag.remixes.toLocaleString()}{' '}
                {flag.remixes === 1 ? 'remix' : 'remixes'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function TopCreatorsCard() {
  const { creators, range } = await getHomeTopCreators().catch(() => ({
    creators: [],
    range: 'all' as const,
  }));
  if (creators.length === 0) return <div className='hidden lg:block' />;
  return (
    <div className='vx-tile flex flex-col overflow-hidden'>
      <CardHeader
        title='Top creators'
        when={range === 'month' ? 'Last 30 days' : 'All time'}
        link={{ href: '/leaderboard', label: 'Leaderboard' }}
      />
      <ol className='pb-2'>
        {creators.map((person, index) => (
          <li key={person.id} className='[&+&]:border-t [&+&]:border-line'>
            <Link
              href={profilePath(person.username)}
              className='flex items-center gap-[11px] px-[18px] py-[7px] hover:bg-foreground/[0.03]'
            >
              <span className='w-3.5 text-right text-[13px] font-semibold tabular-nums text-muted-foreground'>
                {index + 1}
              </span>
              <UserAvatar
                username={person.username}
                image={person.image}
                className='size-7 text-[12px]'
              />
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-[13.5px] font-medium'>
                  @{person.username}
                </span>
                <span className='block truncate text-[11.5px] tabular-nums text-muted-foreground'>
                  {person.posts} {person.posts === 1 ? 'design' : 'designs'} ·{' '}
                  {person.likes.toLocaleString()} likes
                </span>
              </span>
              {person.showcase[0] && (
                <span
                  className='grid h-[30px] w-11 shrink-0 place-items-center'
                  title='Most liked design'
                >
                  <FlagImage
                    src={person.showcase[0].image}
                    alt=''
                    maxHeight={28}
                    fixed
                  />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

async function MakerStrip() {
  const { posts } = await getTrendingPosts().catch(() => ({ posts: [] }));
  return (
    <div className='vx-tile mt-10 flex flex-wrap items-center gap-[18px] px-[22px] py-[18px]'>
      {posts.length > 0 && (
        <div className='flex gap-1.5'>
          {posts.slice(0, 3).map((post) => (
            <span
              key={post.id}
              className='bg-stage grid h-[42px] w-[60px] place-items-center rounded-[9px]'
            >
              <FlagImage src={post.image} alt='' maxHeight={24} fixed />
            </span>
          ))}
        </div>
      )}
      <div className='min-w-[240px] flex-1'>
        <b className='text-[15px] font-semibold'>Flag maker</b>
        <p className='text-[13.5px] text-subtle'>
          Start blank or from any real flag. Free, no account needed to try it.
        </p>
      </div>
      <div className='flex gap-2'>
        <Button asChild variant='neutral'>
          <Link href='/create'>Open the maker</Link>
        </Button>
        <Button asChild>
          <Link href='/signin?callbackUrl=%2Fcreate'>Sign up</Link>
        </Button>
      </div>
    </div>
  );
}
