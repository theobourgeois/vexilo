import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import FollowButton from '@/components/community/FollowButton';
import PostCard from '@/components/community/PostCard';
import PostGrid from '@/components/community/PostGrid';
import { PostGridSkeleton } from '@/components/community/PostCard';
import ShareButton from '@/components/community/ShareButton';
import UserAvatar from '@/components/community/UserAvatar';
import FlagImage from '@/components/FlagImage';
import { Calendar, Heart, Link as LinkIcon, MapPin, PaintBrush, PushPin, SealCheck, Shuffle, Trophy } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { getServerAuthSession } from '@/lib/auth';
import { bandGradient, flagBand, NEUTRAL_BAND } from '@/lib/flag-band';
import { getStoredPalette, type PaletteColor } from '@/lib/flag-palette';
import { profilePath } from '@/lib/post-slug';
import {
  ENCYCLOPEDIA_PAGE_SIZE,
  getPostCards,
  getProfile,
  listEncyclopediaFlags,
  listLikedPosts,
  listPosts,
  type Profile,
} from '@/lib/posts';
import { absoluteUrl } from '@/lib/seo';
import { cn } from '@/lib/utils';
import EditProfileButton from './EditProfileButton';

type Params = Promise<{ username: string }>;
type Search = Promise<{ tab?: string; sort?: string; page?: string }>;

const TABS = ['designs', 'remixes', 'liked', 'encyclopedia'] as const;
type Tab = (typeof TABS)[number];

async function load(params: Params) {
  const { username } = await params;
  const session = await getServerAuthSession();
  const viewerId = session?.user?.id ?? null;
  const name = decodeURIComponent(username).replace(/^@/, '');
  return { profile: await getProfile(name, viewerId), viewerId, name };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { profile } = await load(params);
  if (!profile) return { title: 'Nobody here | Vexilo', robots: { index: false } };
  const title = `@${profile.username} | Vexilo`;
  const description =
    profile.bio ||
    `${profile.stats.posts.toLocaleString()} flag designs by @${profile.username} on Vexilo, the flag maker and encyclopedia.`;
  const url = absoluteUrl(profilePath(profile.username));
  return {
    title,
    description,
    alternates: { canonical: url },
    // Empty profiles stay out of search.
    robots: profile.stats.posts > 0 || profile.stats.encyclopedia > 0 ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Vexilo',
      type: 'profile',
      images: profile.profileFlag ? [{ url: profile.profileFlag.image, alt: profile.profileFlag.name }] : undefined,
    },
  };
}

export default async function ProfilePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { profile, viewerId, name } = await load(params);
  if (!profile) notFound();
  if (profile.username !== name) permanentRedirect(profilePath(profile.username));

  const search = await searchParams;
  const tab: Tab = TABS.includes(search.tab as Tab) ? (search.tab as Tab) : 'designs';
  const sort = search.sort === 'popular' ? 'popular' : 'new';
  const page = Math.max(1, Number.parseInt(search.page ?? '1', 10) || 1);
  const palette = profile.profileFlag ? getStoredPalette(profile.profileFlag).then((colors) => colors ?? []) : null;
  const tabHref = (next: Tab, nextSort = sort) => {
    const query = new URLSearchParams();
    if (next !== 'designs') query.set('tab', next);
    if (nextSort !== 'new' && next !== 'liked' && next !== 'encyclopedia') query.set('sort', nextSort);
    const qs = query.toString();
    return `${profilePath(profile.username)}${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className='pb-16'>
      <div className='relative isolate h-[150px] overflow-hidden sm:h-[210px]'>
        {palette ? (
          <Suspense fallback={<div className='absolute inset-0 -z-10' style={{ backgroundImage: bandGradient(NEUTRAL_BAND) }} />}>
            <Banner palette={palette} />
          </Suspense>
        ) : (
          <div className='absolute inset-0 -z-10 bg-[linear-gradient(135deg,hsl(var(--muted)),hsl(var(--background)))]' />
        )}
        {profile.profileFlag && (
          <Link
            href={profile.profileFlag.href}
            title={profile.profileFlag.name}
            className='absolute bottom-6 right-4 hidden opacity-95 transition hover:opacity-100 sm:block md:right-8 lg:right-[max(2rem,calc((100vw-1312px)/2+2rem))]'
          >
            <FlagImage src={profile.profileFlag.image} alt={profile.profileFlag.name} maxHeight={120} fixed />
          </Link>
        )}
      </div>

      <div className='mx-auto max-w-[1312px] px-4 md:px-8'>
        <div className='-mt-12 flex flex-wrap items-end gap-4 sm:-mt-14'>
          <UserAvatar
            username={profile.username}
            image={profile.image}
            className='size-24 border-4 border-background text-3xl shadow-tile sm:size-28'
          />
          <div className='flex flex-1 flex-wrap items-center justify-end gap-2 pb-1'>
            {profile.isMe ? (
              <EditProfileButton profile={profile} />
            ) : (
              <FollowButton userId={profile.id} following={profile.followingThem} />
            )}
            <ShareButton path={profilePath(profile.username)} title={`@${profile.username} on Vexilo`} label='Share' />
          </div>
        </div>

        <div className='mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]'>
          <div className='min-w-0'>
            <h1 className='flex flex-wrap items-center gap-2 text-[30px] font-semibold tracking-[-0.03em] sm:text-[34px]'>
              @{profile.username}
              {(profile.isTrusted || profile.isAdmin) && (
                <span title={profile.isAdmin ? 'Vexilo team' : 'Trusted editor'} className='text-[hsl(var(--primary))]'>
                  <SealCheck weight='fill' className='size-6' />
                </span>
              )}
              {profile.followsYou && (
                <span className='rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium tracking-normal text-muted-foreground'>Follows you</span>
              )}
            </h1>
            {profile.contestWins.length > 0 && (
              <div className='mt-2 flex flex-wrap gap-1.5'>
                {profile.contestWins.map((win) => (
                  <Link
                    key={win.slug}
                    href={`/contest/${win.slug}`}
                    className='inline-flex h-7 items-center gap-1.5 rounded-full bg-amber-400/15 px-3 text-[12.5px] font-semibold text-amber-700 dark:text-amber-300'
                  >
                    <Trophy weight='fill' className='size-3.5' />
                    Won {win.title}
                  </Link>
                ))}
              </div>
            )}
            {profile.bio && <p className='mt-3 max-w-[620px] text-[15px] leading-relaxed text-subtle'>{profile.bio}</p>}
            <p className='mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px] text-muted-foreground'>
              {profile.location && (
                <span className='inline-flex items-center gap-1.5'>
                  <MapPin className='size-4' />
                  {profile.location}
                </span>
              )}
              {profile.link && (
                <a
                  href={profile.link}
                  target='_blank'
                  rel='noopener noreferrer nofollow ugc'
                  className='inline-flex items-center gap-1.5 font-medium text-foreground hover:underline'
                >
                  <LinkIcon className='size-4' />
                  {profile.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              )}
              <span className='inline-flex items-center gap-1.5'>
                <Calendar className='size-4' />
                Joined {new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </p>
            <p className='mt-3 flex gap-5 text-[14px] text-muted-foreground [&_b]:font-semibold [&_b]:tabular-nums [&_b]:text-foreground'>
              <Link href={`${profilePath(profile.username)}/followers`} className='hover:underline'>
                <b>{profile.stats.followers.toLocaleString()}</b> {profile.stats.followers === 1 ? 'follower' : 'followers'}
              </Link>
              <Link href={`${profilePath(profile.username)}/following`} className='hover:underline'>
                <b>{profile.stats.following.toLocaleString()}</b> following
              </Link>
            </p>
          </div>

          <dl className='vx-tile grid h-fit grid-cols-3 divide-x divide-line text-center'>
            <Stat label='Designs' value={profile.stats.posts} icon={<PaintBrush className='size-4' />} />
            <Stat label='Likes' value={profile.stats.likes} icon={<Heart className='size-4' />} />
            <Stat label='Remixes' value={profile.stats.remixes} icon={<Shuffle className='size-4' />} />
          </dl>
        </div>

        {tab === 'designs' && page === 1 && profile.pinnedPostIds.length > 0 && (
          <Suspense fallback={null}>
            <Pinned profile={profile} viewerId={viewerId} />
          </Suspense>
        )}

        <div className='mt-10 flex flex-wrap items-center gap-3 border-b border-line'>
          <nav className='-mb-px flex gap-1 overflow-x-auto' aria-label='Profile sections'>
            {(
              [
                ['designs', 'Designs', profile.stats.posts],
                ['remixes', 'Remixes', profile.stats.remixes],
                ['liked', 'Liked', null],
                ['encyclopedia', 'Encyclopedia', profile.stats.encyclopedia],
              ] as const
            )
              .filter(([key, , n]) => key !== 'encyclopedia' || (n ?? 0) > 0)
              .map(([key, label, n]) => (
                <Link
                  key={key}
                  href={tabHref(key, key === tab ? sort : 'new')}
                  scroll={false}
                  aria-current={tab === key ? 'page' : undefined}
                  className={cn(
                    'flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[14px] font-medium transition-colors',
                    tab === key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  {n !== null && <span className='tabular-nums text-[12px] text-muted-foreground'>{n.toLocaleString()}</span>}
                </Link>
              ))}
          </nav>
          <span className='flex-1' />
          {(tab === 'designs' || tab === 'remixes') && (
            <div className='vx-well mb-2 flex rounded-full p-0.5 text-[12.5px] font-medium'>
              {(
                [
                  ['new', 'Newest'],
                  ['popular', 'Most liked'],
                ] as const
              ).map(([key, label]) => (
                <Link
                  key={key}
                  href={tabHref(tab, key)}
                  scroll={false}
                  className={cn(
                    'rounded-full px-3 py-1.5',
                    sort === key ? 'bg-surface text-foreground shadow-tile' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className='mt-6'>
          <Suspense key={`${tab}-${sort}-${page}`} fallback={<PostGridSkeleton count={8} />}>
            {tab === 'encyclopedia' ? (
              <Encyclopedia profile={profile} page={page} />
            ) : (
              <Posts profile={profile} viewerId={viewerId} tab={tab} sort={sort} />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Banner({ palette }: { palette: Promise<PaletteColor[]> }) {
  const colors = await palette;
  return <div aria-hidden className='absolute inset-0 -z-10' style={{ backgroundImage: bandGradient(flagBand(colors)) }} />;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className='px-3 py-4'>
      <dd className='text-[22px] font-semibold tabular-nums tracking-[-0.02em]'>{value.toLocaleString()}</dd>
      <dt className='mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground'>
        {icon}
        {label}
      </dt>
    </div>
  );
}

async function Pinned({ profile, viewerId }: { profile: Profile; viewerId: string | null }) {
  const posts = await getPostCards(profile.pinnedPostIds, viewerId);
  if (posts.length === 0) return null;
  return (
    <section className='mt-10'>
      <h2 className='mb-4 flex items-center gap-2 text-[15px] font-semibold'>
        <PushPin weight='fill' className='size-4 text-muted-foreground' />
        Pinned
      </h2>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} showAuthor={false} />
        ))}
      </div>
    </section>
  );
}

async function Posts({ profile, viewerId, tab, sort }: { profile: Profile; viewerId: string | null; tab: Exclude<Tab, 'encyclopedia'>; sort: 'new' | 'popular' }) {
  if (tab === 'liked') {
    const page = await listLikedPosts(profile.id, viewerId);
    return (
      <PostGrid
        initial={page.posts}
        hasMore={page.hasMore}
        request={{ likedBy: profile.id }}
        columns='four'
        empty={<Empty>{profile.isMe ? 'Flags you like show up here.' : `@${profile.username} hasn’t liked anything yet.`}</Empty>}
      />
    );
  }
  const request = { sort, range: 'all' as const, authorId: profile.id, ...(tab === 'remixes' ? { remixes: true } : {}) };
  const page = await listPosts({ ...request, viewerId });
  return (
    <PostGrid
      initial={page.posts}
      hasMore={page.hasMore}
      request={request}
      showAuthor={false}
      columns='four'
      empty={
        <Empty>
          {profile.isMe ? (
            <>
              {tab === 'remixes' ? 'Remix any flag and it shows up here.' : 'Post a design from the flag maker and it shows up here.'}
              <div className='mt-4'>
                <Button asChild>
                  <Link href='/create'>
                    <PaintBrush />
                    Make a flag
                  </Link>
                </Button>
              </div>
            </>
          ) : tab === 'remixes' ? (
            `@${profile.username} hasn’t posted any remixes yet.`
          ) : (
            `@${profile.username} hasn’t posted any designs yet.`
          )}
        </Empty>
      }
    />
  );
}

async function Encyclopedia({ profile, page }: { profile: Profile; page: number }) {
  const { flags, total } = await listEncyclopediaFlags(profile.id, page);
  const pages = Math.ceil(total / ENCYCLOPEDIA_PAGE_SIZE);
  return (
    <div>
      <p className='mb-4 text-[13.5px] text-muted-foreground'>
        Real flags @{profile.username} added to the Vexilo encyclopedia.
      </p>
      {flags.length === 0 ? (
        <Empty>Nothing on this page.</Empty>
      ) : (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
          {flags.map((flag) => (
            <Link key={flag.id} href={flag.href} className='vx-tile group flex flex-col overflow-hidden transition-shadow hover:shadow-tile-hover'>
              <div className='flag-stage bg-stage flex h-[96px] items-center justify-center p-4'>
                <FlagImage src={flag.image} alt={flag.name} maxHeight={64} />
              </div>
              <span className='truncate border-t border-line px-3 py-2 text-[12.5px] font-medium'>{flag.name}</span>
            </Link>
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className='mt-6 flex items-center justify-center gap-3 text-[13px]'>
          {page > 1 && (
            <Button variant='neutral' size='sm' asChild>
              <Link href={`${profilePath(profile.username)}?tab=encyclopedia&page=${page - 1}`}>Previous</Link>
            </Button>
          )}
          <span className='tabular-nums text-muted-foreground'>
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Button variant='neutral' size='sm' asChild>
              <Link href={`${profilePath(profile.username)}?tab=encyclopedia&page=${page + 1}`}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className='rounded-2xl border border-dashed border-border px-6 py-12 text-center text-[14px] text-subtle'>{children}</div>;
}
