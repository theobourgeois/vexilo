import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import CreatorRow from '@/components/community/CreatorRow';
import PostGrid from '@/components/community/PostGrid';
import { PostGridSkeleton } from '@/components/community/PostCard';
import FlagImage from '@/components/FlagImage';
import { PaintBrush, Users } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { getServerAuthSession } from '@/lib/auth';
import {
  getCommunityTotals,
  getMostRemixedFlags,
  getPopularPostTags,
  getTopCreators,
  listPosts,
  type PostRange,
  type PostSort,
} from '@/lib/posts';
import { absoluteUrl } from '@/lib/seo';
import FeedControls from './FeedControls';

export const metadata: Metadata = {
  title: 'Community flags: designs by Vexilo members | Vexilo',
  description: 'Flags designed by the Vexilo community: fictional nations, redesigns and remixes of real flags. Make your own in the flag maker.',
  alternates: { canonical: absoluteUrl('/community') },
};

type SearchParams = Promise<{ sort?: string; range?: string; tag?: string; q?: string; remixes?: string }>;

const SORTS: PostSort[] = ['popular', 'new', 'following'];
const RANGES: PostRange[] = ['today', 'week', 'month', 'all'];

export default async function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sort = SORTS.includes(params.sort as PostSort) ? (params.sort as PostSort) : 'popular';
  const range = RANGES.includes(params.range as PostRange) ? (params.range as PostRange) : 'week';
  const tag = params.tag?.slice(0, 40).toLowerCase() || null;
  const search = params.q?.slice(0, 80) ?? '';
  const remixes = params.remixes === '1';
  const session = await getServerAuthSession();
  const viewerId = session?.user?.id ?? null;

  const [totals, tags] = await Promise.all([getCommunityTotals(), getPopularPostTags(6)]);

  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-16 md:px-8'>
      <div className='mt-8 flex flex-wrap items-end gap-4'>
        <div className='min-w-[260px] flex-1'>
          <h1 className='text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[40px]'>Community</h1>
          <p className='mt-2 text-[15px] text-subtle'>
            Flags designed by Vexilo members.{' '}
            <b className='font-medium text-foreground'>{totals.posts.toLocaleString()} designs</b> from{' '}
            <b className='font-medium text-foreground'>{totals.creators.toLocaleString()} creators</b>.
          </p>
        </div>
        <Button asChild>
          <Link href='/create'>
            <PaintBrush />
            Make a flag
          </Link>
        </Button>
      </div>

      <div className='mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]'>
        <div className='min-w-0'>
          <FeedControls sort={sort} range={range} tag={tag} remixes={remixes} search={search} tags={tags} />
          <Suspense key={JSON.stringify({ sort, range, tag, search, remixes })} fallback={<PostGridSkeleton count={9} />}>
            <Feed sort={sort} range={range} tag={tag} search={search} remixes={remixes} viewerId={viewerId} />
          </Suspense>
        </div>
        <aside className='flex flex-col gap-4'>
          <Suspense fallback={<div className='vx-tile h-[260px] animate-pulse' />}>
            <Rail viewerId={viewerId} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

async function Feed({
  sort,
  range,
  tag,
  search,
  remixes,
  viewerId,
}: {
  sort: PostSort;
  range: PostRange;
  tag: string | null;
  search: string;
  remixes: boolean;
  viewerId: string | null;
}) {
  const request = {
    sort,
    range,
    ...(tag ? { tag } : {}),
    ...(search ? { search } : {}),
    ...(remixes ? { remixes: true } : {}),
  };
  const first = await listPosts({ ...request, viewerId });
  // A quiet week shouldn't look empty: fall back to all time.
  const fellBack = sort === 'popular' && range !== 'all' && first.posts.length === 0 && !tag && !search && !remixes;
  const page = fellBack ? await listPosts({ ...request, range: 'all', viewerId }) : first;

  const empty =
    sort === 'following' ? (
      <EmptyState
        icon={<Users className='size-6' />}
        title={viewerId ? 'Follow creators to fill this' : 'Sign in to follow creators'}
        body='Designs from people you follow show up here, newest first.'
      />
    ) : (
      <EmptyState icon={<PaintBrush className='size-6' />} title='Nothing here yet' body='Try another filter, or make the first one.' />
    );

  return (
    <>
      {fellBack && <p className='mb-3 text-[13px] text-muted-foreground'>Nothing new in that range, so here’s the all-time best.</p>}
      <PostGrid initial={page.posts} hasMore={page.hasMore} request={fellBack ? { ...request, range: 'all' } : request} empty={empty} columns='three' />
    </>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className='vx-tile flex flex-col items-center gap-2 px-6 py-16 text-center'>
      <div className='text-muted-foreground'>{icon}</div>
      <h2 className='text-[16px] font-semibold'>{title}</h2>
      <p className='max-w-[340px] text-sm text-muted-foreground'>{body}</p>
    </div>
  );
}

async function Rail({ viewerId }: { viewerId: string | null }) {
  const [suggested, remixed, top] = await Promise.all([
    getTopCreators({ viewerId, range: 'all', limit: 4, excludeFollowed: true }),
    getMostRemixedFlags(5),
    getTopCreators({ viewerId, range: 'month', limit: 5 }),
  ]);
  return (
    <>
      {suggested.length > 0 && (
        <section className='vx-tile px-[18px] py-4'>
          <h2 className='mb-1 text-[14px] font-semibold'>Creators to follow</h2>
          {suggested.map((person) => (
            <CreatorRow key={person.id} person={person} detail={person.bio || `${person.posts} designs · ${person.likes.toLocaleString()} likes`} />
          ))}
        </section>
      )}
      {remixed.length > 0 && (
        <section className='vx-tile px-[18px] py-4'>
          <h2 className='mb-2 text-[14px] font-semibold'>Most remixed flags</h2>
          <ul className='space-y-1'>
            {remixed.map((flag) => (
              <li key={flag.id}>
                <Link href={`/flag/${encodeURIComponent(flag.name)}`} className='-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-1.5 hover:bg-foreground/[0.04]'>
                  <span className='flex w-11 shrink-0 justify-center'>
                    <FlagImage src={flag.image} alt='' maxHeight={26} fixed />
                  </span>
                  <span className='min-w-0 flex-1 truncate text-[13.5px] font-medium'>{flag.name}</span>
                  <span className='shrink-0 tabular-nums text-[12px] text-muted-foreground'>{flag.remixes} remixes</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {top.length > 0 && (
        <section className='vx-tile px-[18px] py-4'>
          <h2 className='mb-2 text-[14px] font-semibold'>
            Top creators · {new Date().toLocaleDateString('en-US', { month: 'long' })}
          </h2>
          <ol className='space-y-1'>
            {top.map((person, index) => (
              <li key={person.id}>
                <Link href={`/@${person.username}`} className='-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-1.5 hover:bg-foreground/[0.04]'>
                  <span className='w-4 shrink-0 text-center tabular-nums text-[12.5px] font-semibold text-muted-foreground'>{index + 1}</span>
                  <span className='min-w-0 flex-1 truncate text-[13.5px] font-medium'>{person.username}</span>
                  <span className='shrink-0 tabular-nums text-[12px] text-muted-foreground'>{person.likes.toLocaleString()} likes</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
