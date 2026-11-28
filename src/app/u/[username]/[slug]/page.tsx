import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import FlagViewer from '@/app/flag/[flagName]/FlagViewer';
import DescriptionBox from '@/app/flag/[flagName]/DescriptionBox';
import FollowButton from '@/components/community/FollowButton';
import { LikeButton } from '@/components/community/LikeButton';
import PostGrid from '@/components/community/PostGrid';
import { PostGridSkeleton } from '@/components/community/PostCard';
import PostViewTracker from '@/components/community/PostViewTracker';
import ShareButton from '@/components/community/ShareButton';
import UserAvatar from '@/components/community/UserAvatar';
import FlagImage from '@/components/FlagImage';
import { ArrowRight, ChevronLeft, Shuffle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { getServerAuthSession } from '@/lib/auth';
import { bandGradient, flagBand } from '@/lib/flag-band';
import { getStoredPalette, type PaletteColor } from '@/lib/flag-palette';
import { profilePath } from '@/lib/post-slug';
import { getPost, INDEXABLE_LIKES, listPosts, type PostDetail } from '@/lib/posts';
import { absoluteUrl } from '@/lib/seo';
import PostOwnerMenu from './PostOwnerMenu';

type Params = Promise<{ username: string; slug: string }>;

/** The old flag maker filled descriptions in itself ("A remix of X, made with the Vexilo flag maker."); those say nothing, so they're hidden. */
const FILLER_DESCRIPTION = /^(A remix of .+, made|Made) with the Vexilo flag maker\.?$/;
const ownDescription = (text: string) => (FILLER_DESCRIPTION.test(text.trim()) ? '' : text);

const formatDate = (date: Date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

async function load(params: Params) {
  const { username, slug } = await params;
  const session = await getServerAuthSession();
  const viewerId = session?.user?.id ?? null;
  const post = await getPost(decodeURIComponent(username), decodeURIComponent(slug), viewerId);
  return { post, viewerId, username: decodeURIComponent(username) };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { post } = await load(params);
  if (!post) return { title: 'Flag not found | Vexilo', robots: { index: false } };
  const url = absoluteUrl(post.path);
  const title = `${post.name} by @${post.author.username} | Vexilo`;
  const description =
    ownDescription(post.description).slice(0, 200) || `A flag designed by @${post.author.username} on Vexilo. Remix it or make your own in the flag maker.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Only designs people have liked go into search engines.
    robots: post.likes >= INDEXABLE_LIKES ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, siteName: 'Vexilo', images: [{ url: post.image, alt: post.name }] },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: post.image, alt: post.name }] },
  };
}

export default async function PostPage({ params }: { params: Params }) {
  const { post, viewerId, username } = await load(params);
  if (!post) notFound();
  if (post.author.username !== username) permanentRedirect(post.path);

  const description = ownDescription(post.description);
  const palette = getStoredPalette({ kind: 'post', id: post.id, image: post.image }).then((colors) => colors ?? []);
  const pinned = post.isMine
    ? await db
        .select({ pinned: sql<boolean>`${post.id}::uuid = any(${users.pinnedPostIds})` })
        .from(users)
        .where(eq(users.id, post.author.id))
        .then((rows) => Boolean(rows[0]?.pinned))
    : false;

  return (
    <>
      {/* The author's own visits don't count. */}
      {viewerId !== post.author.id && <PostViewTracker postId={post.id} />}
      <div className='flag-band relative isolate'>
        <Suspense fallback={null}>
          <Band palette={palette} />
        </Suspense>
        <div className='mx-auto max-w-[1312px] px-4 pb-10 md:px-8 lg:pb-12'>
          <nav className='pb-4 pt-[22px] text-[13px] text-muted-foreground'>
            <Link href='/community' className='inline-flex items-center gap-1 hover:text-foreground'>
              <ChevronLeft className='size-3' />
              Community
            </Link>
          </nav>

          <div className='grid items-center gap-8 pt-2 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-16 lg:pt-3.5'>
            <div className='min-w-0'>
              <FlagViewer image={post.image} name={post.name} variant='band' />
            </div>
            <div className='min-w-0'>
              <h1 className='text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[40px] lg:text-[44px]'>{post.name}</h1>

              <div className='mt-4 flex flex-wrap items-center gap-3'>
                <Link href={profilePath(post.author.username)} className='flex min-w-0 items-center gap-2 hover:underline'>
                  <UserAvatar username={post.author.username} image={post.author.image} className='size-7 text-xs' />
                  <b className='truncate text-[14px] font-semibold'>{post.author.username}</b>
                </Link>
                {!post.isMine && <FollowButton userId={post.author.id} following={post.following} size='sm' />}
              </div>

              {post.remixOf && (
                <p className='mt-4 flex min-w-0 items-center gap-2 text-[13.5px] text-muted-foreground'>
                  <Shuffle className='size-3.5 shrink-0' />
                  <span className='shrink-0'>Remix of</span>
                  <Link href={post.remixOf.href} className='flex min-w-0 items-center gap-2 font-medium text-foreground hover:underline'>
                    <FlagImage src={post.remixOf.image} alt='' maxHeight={18} fixed />
                    <span className='truncate'>{post.remixOf.name}</span>
                  </Link>
                  {post.remixOf.author && post.remixOf.author !== post.author.username && (
                    <span className='shrink-0'>by @{post.remixOf.author}</span>
                  )}
                </p>
              )}

              {description && (
                <div className='mt-4 max-w-[560px]'>
                  <DescriptionBox text={description} long={description.length > 620} />
                </div>
              )}

              <div className='mt-6 flex flex-wrap gap-2'>
                <LikeButton postId={post.id} liked={post.liked} likes={post.likes} />
                <Button variant='neutral' asChild>
                  <Link href={`/create?remixPost=${post.id}`}>
                    <Shuffle />
                    Remix
                  </Link>
                </Button>
                <ShareButton path={post.path} title={post.name} />
                {post.isMine && (
                  <PostOwnerMenu
                    post={{ id: post.id, name: post.name, description: post.description, tags: post.tags }}
                    hasDesign={post.hasDesign}
                    pinned={pinned}
                    profileHref={profilePath(post.author.username)}
                  />
                )}
              </div>

              <div className='mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground'>
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/community?tag=${encodeURIComponent(tag)}&range=all`}
                    className='inline-flex h-7 items-center rounded-full bg-white/10 px-3 text-[12.5px] font-medium capitalize text-subtle shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] hover:text-foreground'
                  >
                    {tag}
                  </Link>
                ))}
                <span className='tabular-nums'>
                  {formatDate(post.publishedAt)} · {post.views.toLocaleString()} {post.views === 1 ? 'view' : 'views'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='mx-auto max-w-[1312px] px-4 pb-16 md:px-8'>
        {post.remixCount > 0 && (
          <Suspense fallback={<PostGridSkeleton count={4} />}>
            <Remixes post={post} viewerId={viewerId} />
          </Suspense>
        )}
        <Suspense fallback={null}>
          <MoreFromAuthor postId={post.id} authorId={post.author.id} username={post.author.username} viewerId={viewerId} />
        </Suspense>
      </div>
    </>
  );
}

async function Band({ palette }: { palette: Promise<PaletteColor[]> }) {
  const colors = await palette;
  return (
    <div aria-hidden className='absolute inset-0 -z-10 animate-in fade-in duration-300' style={{ backgroundImage: bandGradient(flagBand(colors)) }} />
  );
}

function SectionHeading({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className='mb-4 mt-12 flex items-center gap-2.5'>
      <h2 className='min-w-0 truncate text-[17px] font-semibold tracking-[-0.02em]'>{title}</h2>
      {count !== undefined && <span className='tabular-nums text-[13px] text-muted-foreground'>{count}</span>}
      <span className='flex-1' />
      {action && <div className='shrink-0'>{action}</div>}
    </div>
  );
}

async function Remixes({ post, viewerId }: { post: PostDetail; viewerId: string | null }) {
  const request = { sort: 'popular' as const, range: 'all' as const, remixOfPostId: post.id };
  const page = await listPosts({ ...request, viewerId, limit: 8 });
  return (
    <section>
      <SectionHeading title='Remixes' count={post.remixCount} />
      <PostGrid initial={page.posts} hasMore={page.hasMore} request={request} />
    </section>
  );
}

async function MoreFromAuthor({ postId, authorId, username, viewerId }: { postId: string; authorId: string; username: string; viewerId: string | null }) {
  const page = await listPosts({ sort: 'popular', range: 'all', authorId, excludeIds: [postId], viewerId, limit: 4 });
  if (page.posts.length === 0) return null;
  return (
    <section>
      <SectionHeading
        title={`More from @${username}`}
        action={
          <Button variant='neutral' size='sm' asChild>
            <Link href={profilePath(username)}>
              View profile <ArrowRight />
            </Link>
          </Button>
        }
      />
      <PostGrid initial={page.posts} hasMore={false} showAuthor={false} />
    </section>
  );
}
