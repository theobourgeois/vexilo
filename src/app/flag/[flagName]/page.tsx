import {
  getFlagDetailFromName,
  getRelatedFlags,
  getFlagEditHistory,
} from '@/actions/flags';
import Link from 'next/link';
import { ArrowLeft, BookOpen, ChevronRight } from '@/components/icons';
import { after } from 'next/server';
import { addCacheTag } from '@vercel/functions';
import { FLAGS_TAG } from '@/lib/cache-tags';
import { Button } from '@/components/ui/button';
import { notFound } from 'next/navigation';
import Contributors, { type Contributor, type EditEntry } from './Contributors';
import FlagActions from './FlagActions';
import FavoriteCount from './FavoriteCount';
import RelatedFlagCards from './RelatedFlagCards';
import ExpandableDescription from './ExpandableDescription';
import FlagViewer from './FlagViewer';
import FlagViewTracker from './FlagViewTracker';
import FlagTimeline from './FlagTimeline';
import HistoryText from './HistoryText';
import AddHistoryButton from './AddHistoryButton';
import { getFlagTimeline, type FlagTimelineView } from '@/actions/flag-timeline';
import type { FlagAiResearchSource, FlagAiStructuredData } from '@/db/schema';
import { Metadata } from 'next';
import Tag from '@/components/Tag';
import { Suspense } from 'react';
import FlagFieldsForm from '@/components/FlagFieldsForm';
import SourceBadge from '@/components/SourceBadge';
import { describeEdit } from '@/lib/edit-changes';
import { getFlagColors, paletteFamilies, type PaletteColor } from '@/lib/flag-palette';
import { ensureFlagImageSelfHosted } from '@/lib/storage/flag-image-mirror';
import { getFlagNameById } from '@/lib/studio-data';
import { MakerBadge } from '@/components/MakerBadge';
import { MAKER_TAGS } from '@/lib/studio-design';
import { collectionPath, getColourCollection } from '@/lib/collections';
import { absoluteUrl, flagHeadline, flagPath, jsonLd } from '@/lib/seo';
import { bandGradient, flagBand } from '@/lib/flag-band';
import { cn } from '@/lib/utils';

export type RelatedFlag = {
  name: string;
  image: string;
  link: string;
};

type Props = {
  params: Promise<{ flagName: string }>;
};

/** "Flag of Canada: Meaning & History | Vexilo", as people search for it; history only when the page has some. */
function flagPageTitle(flag: { name: string; metadata?: { historicalContext?: string | null } | null }) {
  const headline = flagHeadline(flag.name);
  return flag.metadata?.historicalContext ? `${headline}: Meaning & History | Vexilo` : `${headline} | Vexilo`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const flagName = decodeURIComponent((await params).flagName);
  const flag = await getFlagDetailFromName(flagName);
  if (flag) {
    const pageUrl = absoluteUrl(flagPath(flag.name));
    const title = flagPageTitle(flag);
    return {
      title,
      description: flag.displayDescription,
      keywords: [
        flag.name,
        ...flag.displayTags,
        'Vexilo',
        'Flags',
        'World Flags',
        'Flag Collection',
        'Flag Search',
        'Flag Collection',
      ],
      openGraph: {
        title: title,
        description: flag.displayDescription,
        url: pageUrl,
        siteName: 'Vexilo',
        images: [
          {
            url: flag.image,
            alt: flag.name,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: flag.displayDescription,
        images: [
          {
            url: flag.image,
            alt: flag.name,
          },
        ],
      },
      alternates: {
        canonical: pageUrl,
      },
    };
  }

  return {
    title: 'Flag Not Found - Vexilo',
    description:
      "The flag you're looking for doesn't exist. Please check the flag name and try again.",
    keywords: [
      'Vexilo',
      'Flags',
      'World Flags',
      'Flag Collection',
      'Flag Search',
    ],
  };
}

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatShare = (share: number) => (share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`);

const humanize = (value: string) =>
  value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** One cell of the strips under the header: a small label over its value. */
function Fact({ label, className, children }: { label: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 bg-surface px-5 py-4', className)}>
      <h2 className='vx-label'>{label}</h2>
      <div className='mt-1.5 truncate text-[17px] font-semibold tracking-[-0.01em]'>{children}</div>
    </div>
  );
}

// The 1px gaps show the strip's background through, which draws the dividers between cells.
const stripClass = 'vx-strip grid gap-px overflow-hidden rounded-2xl shadow-tile';

// Colours are read from the image itself (cached), so they stream in after the page.
async function ColoursFact({ colors }: { colors: Promise<PaletteColor[]> }) {
  const palette = await colors.catch(() => [] as PaletteColor[]);
  const total = palette.reduce((sum, color) => sum + color.share, 0);
  const collection = palette.length > 0 ? getColourCollection(paletteFamilies(palette)) : null;
  return (
    <div className='col-span-2 min-w-0 bg-surface px-5 py-4 lg:col-span-1'>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='vx-label'>Colours{palette.length > 0 && ` · ${palette.length}`}</h2>
        {collection && (
          <Link
            href={collectionPath(collection.slug)}
            className='inline-flex items-center gap-0.5 truncate text-[12.5px] font-medium text-main hover:underline'
          >
            More {collection.title.toLowerCase()}
            <ChevronRight className='size-3' />
          </Link>
        )}
      </div>
      {palette.length === 0 ? (
        <p className='mt-1.5 text-[13.5px] text-muted-foreground'>Couldn&apos;t read this flag&apos;s colours.</p>
      ) : (
        <>
          <div className='relative mt-2.5 flex h-2.5 overflow-hidden rounded-full after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_0_0_1px_var(--border)]'>
            {palette.map((color) => (
              <span key={color.hex} style={{ flex: color.share / total, minWidth: 4, background: color.hex }} />
            ))}
          </div>
          <ul className='mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px]'>
            {palette.map((color) => (
              <li key={color.hex} title={color.hex} className='flex items-center gap-1.5'>
                <span
                  className='size-[11px] shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]'
                  style={{ background: color.hex }}
                />
                {color.name}
                <span className='tabular-nums text-muted-foreground'>{formatShare(color.share)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ColoursFactSkeleton() {
  return (
    <div className='col-span-2 bg-surface px-5 py-4 lg:col-span-1'>
      <div className='vx-label'>Colours</div>
      <div className='mt-2.5 h-2.5 animate-pulse rounded-full bg-foreground/[0.06]' />
      <div className='mt-3 h-3 w-2/3 animate-pulse rounded bg-foreground/[0.06]' />
    </div>
  );
}

function TraitsStrip({ data }: { data: FlagAiStructuredData }) {
  const rows: [string, string][] = [];
  if (data.layoutType) rows.push(['Layout', humanize(data.layoutType)]);
  if (data.patternType) rows.push(['Pattern', humanize(data.patternType)]);
  if (data.primarySymbols?.length) rows.push(['Symbols', data.primarySymbols.map(humanize).join(', ')]);
  if (data.emblemPlacement && data.emblemPlacement !== 'none') rows.push(['Emblem', humanize(data.emblemPlacement)]);
  if (data.hasText !== undefined) rows.push(['Text', data.hasText ? humanize(data.textType ?? 'yes') : 'None']);
  if (rows.length === 0) return null;
  return (
    <section aria-label='Traits' className={cn(stripClass, 'mt-4 grid-cols-2 md:auto-cols-fr md:grid-flow-col md:grid-cols-none')}>
      {rows.map(([label, value], i) => (
        <div
          key={label}
          // A lone last cell spans both columns on phones, so no empty gap shows.
          className={cn('min-w-0 bg-surface px-5 py-3.5', i === rows.length - 1 && rows.length % 2 === 1 && 'col-span-2 md:col-span-1')}
        >
          <h3 className='vx-label'>{label}</h3>
          <p className='mt-1 truncate text-[14.5px] font-medium' title={value}>
            {value}
          </p>
        </div>
      ))}
    </section>
  );
}

/** The header's colour, picked from the flag's palette once it has streamed in. */
async function BandBackdrop({ colors }: { colors: Promise<PaletteColor[]> }) {
  const palette = await colors.catch(() => [] as PaletteColor[]);
  return (
    <div
      aria-hidden
      className='absolute inset-0 -z-10 animate-in fade-in duration-300'
      style={{ backgroundImage: bandGradient(flagBand(palette)) }}
    />
  );
}

// Separate component for related flags to enable streaming
async function RelatedFlagsSection({ flagId }: { flagId: string }) {
  const relatedFlags = await getRelatedFlags(flagId);

  if (!relatedFlags || relatedFlags.length === 0) {
    return null;
  }

  return (
    <section className='mt-14'>
      <h2 className='mb-4 text-[17px] font-semibold tracking-[-0.02em]'>Related flags</h2>
      <RelatedFlagCards
        flags={relatedFlags.map((relatedFlag) => ({
          id: relatedFlag.id,
          flagName: relatedFlag.name,
          flagImage: relatedFlag.image,
          sources: relatedFlag.sources,
          favorites: relatedFlag.favorites,
          link: relatedFlag.link,
          index: relatedFlag.index,
          tags: relatedFlag.tags,
          description: relatedFlag.description,
        }))}
      />
    </section>
  );
}

// Streams in after the page so the edit history query doesn't block it.
async function ContributorsSection({ flagId }: { flagId: string }) {
  const editHistory = await getFlagEditHistory(flagId);
  if (!editHistory || editHistory.length === 0) return null;

  // History is newest first, so the first edit seen per user is their latest.
  const byUser = new Map<string, Contributor>();
  for (const edit of editHistory) {
    const existing = byUser.get(edit.userNumber);
    if (existing) existing.edits++;
    else
      byUser.set(edit.userNumber, {
        userNumber: edit.userNumber,
        name: edit.userName,
        image: edit.userImage,
        edits: 1,
        lastEditedAt: edit.createdAt,
      });
  }
  const contributors = [...byUser.values()].sort((a, b) => b.edits - a.edits);
  // getFlagEditHistory caps at 50 rows.
  const totalEdits = editHistory.length >= 50 ? '50+' : String(editHistory.length);
  const edits: EditEntry[] = editHistory.map((edit) => ({
    id: edit.id,
    user: { userNumber: edit.userNumber, name: edit.userName, image: edit.userImage },
    createdAt: edit.createdAt,
    changes: describeEdit(edit.oldFlag, edit.newFlag),
  }));

  return (
    <div>
      <h2 className='mb-2.5 text-sm font-semibold'>Contributors</h2>
      <Contributors contributors={contributors} totalEdits={totalEdits} edits={edits} />
    </div>
  );
}

/** schema.org description of the page and its flag image, for search results and image search. */
function flagStructuredData(flag: { name: string; image: string; displayDescription: string; metadata?: { historicalContext?: string | null } | null }) {
  const url = absoluteUrl(flagPath(flag.name));
  const headline = flagHeadline(flag.name);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: flagPageTitle(flag),
        description: flag.displayDescription,
        isPartOf: { '@type': 'WebSite', name: 'Vexilo', url: absoluteUrl('/') },
        primaryImageOfPage: { '@id': `${url}#flag` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'ImageObject',
        '@id': `${url}#flag`,
        contentUrl: absoluteUrl(flag.image),
        name: headline,
        caption: headline,
        description: flag.displayDescription,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Vexilo', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: flag.name, item: url },
        ],
      },
    ],
  };
}

const normalizeUrl = (url: string) => url.trim().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').toLowerCase();

/** The flag's own sources plus the pages its history was researched from, without dead redirect links. */
function collectSources(own: string[], researched: FlagAiResearchSource[]) {
  const urls = [
    ...own,
    ...researched
      .filter((source) => source.type !== 'llm' && source.url && /^https?:\/\//.test(source.url))
      .map((source) => source.url as string)
      // Search-grounding redirects expire, so they make poor links.
      .filter((url) => !url.includes('vertexaisearch.cloud.google.com')),
  ];
  const seen = new Set<string>();
  return urls.filter((url) => {
    const key = normalizeUrl(url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function HistoryHeading() {
  return (
    <h2 className='mb-3.5 flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em]'>
      <BookOpen className='size-[18px] text-muted-foreground' />
      History
    </h2>
  );
}

function AddHistoryPrompt({ flagName }: { flagName: string }) {
  return (
    <div className='flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border px-6 py-5 sm:flex-row sm:items-center'>
      <BookOpen className='hidden size-5 shrink-0 text-muted-foreground sm:block' />
      <div className='flex-1'>
        <h2 className='text-[15px] font-semibold'>No history yet</h2>
        <p className='mt-0.5 text-[13.5px] text-subtle'>
          Know where this flag comes from or what it stands for? Add its story so others can read it.
        </p>
      </div>
      <AddHistoryButton flagName={flagName} />
    </div>
  );
}

/**
 * History, then the timeline, each across the full width: a long history flows into two columns and the
 * timeline's events do too, so neither leaves an empty half of the page beside a long neighbour.
 */
function Story({
  history,
  timeline,
  flagName,
  promptForHistory,
}: {
  history: string;
  timeline: FlagTimelineView | null;
  flagName: string;
  promptForHistory: boolean;
}) {
  const historyBlock = history ? (
    <section>
      <HistoryHeading />
      <HistoryText text={history} columns={history.length > 700} />
    </section>
  ) : promptForHistory ? (
    <AddHistoryPrompt flagName={flagName} />
  ) : null;
  if (!historyBlock && !timeline) return null;
  return (
    <div className='mt-12 space-y-12'>
      {historyBlock}
      {timeline && <FlagTimeline timeline={timeline} columns />}
    </div>
  );
}

// The timeline streams in after the page; most flags have none, so the fallback is the layout without it.
async function StorySection(props: Omit<React.ComponentProps<typeof Story>, 'timeline'> & { flagId: string }) {
  const timeline = await getFlagTimeline(props.flagId);
  return <Story {...props} timeline={timeline} />;
}

export default async function FlagPage({
  params,
  searchParams,
}: {
  params: Promise<{ flagName: string }>;
  searchParams: Promise<{ mode: string }>;
}) {
  // The CDN keeps this page (see next.config.ts); the tag is what lets a flag edit throw its copies
  // away, the same way it expires the cached data. First, so a "not found" answer is tagged too.
  await addCacheTag(FLAGS_TAG);

  const { flagName: flagNameRaw } = await params;
  const flagName = decodeURIComponent(flagNameRaw);
  const flag = await getFlagDetailFromName(flagName);
  const mode = (await searchParams).mode;

  if (!flag) {
    notFound();
  }

  after(async () => {
    try {
      await ensureFlagImageSelfHosted(flag);
    } catch (error) {
      console.error(
        `[flag-image-mirror] Failed to mirror "${flag.name}" (${flag.id}):`,
        error,
      );
    }
  });

  if (mode === 'edit') {
    return (
      <div className='mx-auto max-w-[1100px] px-4 py-7 md:px-8'>
        <div className='mb-6 flex items-center justify-between gap-4'>
          <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>
            Edit {flag.name}
          </h1>
          <Button variant='neutral' asChild>
            <Link href={`/flag/${encodeURIComponent(flag.name)}`}>
              <ArrowLeft />
              Back
            </Link>
          </Button>
        </div>

        <FlagFieldsForm
          initialFlag={{
            id: flag.id,
            flagName: flag.name,
            flagImage: flag.image,
            sources: flag.sources,
            link: flag.link,
            index: flag.index,
            tags: flag?.tags,
            description: flag.description,
            relatedFlags: [],
          }}
        />
      </div>
    );
  }

  // Shared by the header colour, the colours strip and the custom colour view, so the image is only read once.
  const colors = getFlagColors(flag);
  const madeInMaker = flag.tags.some((tag) => MAKER_TAGS.includes(tag));
  const original = flag.remixOf ? await getFlagNameById(flag.remixOf) : null;
  const structured = flag.metadata?.structuredData ?? null;
  const history = flag.metadata?.historicalContext ?? '';
  const sources = collectSources(flag.sources ?? [], flag.metadata?.researchSources ?? []);
  const firstTag = flag.displayTags.find((t) => t.toLowerCase() !== flag.name.toLowerCase());
  const catalogue = `#${String(flag.index).padStart(4, '0')}`;
  const extension = flag.image.split('?')[0].split('.').pop()?.toUpperCase();
  const sourceHost = (() => {
    if (!flag.link) return null;
    try {
      return new URL(flag.link).hostname.replace(/^www\./, '');
    } catch {
      return flag.link;
    }
  })();
  const storyProps = { history, flagName: flag.name, promptForHistory: !madeInMaker };

  return (
    <>
      <FlagViewTracker flagId={flag.id} />
      <script type='application/ld+json' dangerouslySetInnerHTML={jsonLd(flagStructuredData(flag))} />

      <div className='flag-band relative isolate'>
        <Suspense fallback={null}>
          <BandBackdrop colors={colors} />
        </Suspense>
        <div className='mx-auto max-w-[1312px] px-4 pb-[84px] md:px-8 lg:pb-[92px]'>
          <nav className='flex items-center gap-2 pb-4 pt-[22px] text-[13px] text-muted-foreground'>
            <Link href='/' className='hover:text-foreground'>
              Browse
            </Link>
            {firstTag && (
              <>
                <ChevronRight className='size-3' />
                <Link href={`/?tag=${encodeURIComponent(firstTag)}`} className='hover:text-foreground'>
                  {firstTag}
                </Link>
              </>
            )}
            <ChevronRight className='size-3' />
            <span className='truncate font-medium text-foreground'>{flag.name}</span>
          </nav>

          <div className='grid items-center gap-8 pt-2 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-16 lg:pt-3.5'>
            <div className='min-w-0'>
              <FlagViewer image={flag.image} name={flag.name} palette={colors} variant='band' />
            </div>

            <div className='min-w-0'>
              <p className='flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground'>
                <MakerBadge tags={flag.tags} className='bg-white/15 text-white dark:bg-white/15 dark:text-white' />
                <span>
                  {catalogue}
                  {firstTag ? ` · ${firstTag}` : ''}
                </span>
              </p>
              <h1 className='mt-1.5 text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[46px] lg:text-[54px]'>
                {flag.name}
              </h1>
              {madeInMaker && (
                <p className='mt-4 max-w-[560px] rounded-[12px] bg-white/10 px-3.5 py-2.5 text-[13px] text-subtle shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]'>
                  <span className='font-semibold text-foreground'>Not an official flag.</span>{' '}
                  {original ? (
                    <>
                      A remix of{' '}
                      <Link
                        href={`/flag/${encodeURIComponent(original.name)}`}
                        className='font-medium text-foreground underline decoration-white/40 underline-offset-2 hover:decoration-white'
                      >
                        {original.name}
                      </Link>
                      , made in the flag maker.
                    </>
                  ) : (
                    'Made in the flag maker.'
                  )}
                </p>
              )}
              {flag.displayDescription && (
                <div className='mt-3.5 max-w-[560px]'>
                  <ExpandableDescription description={flag.displayDescription} />
                </div>
              )}
              <div className='mt-6'>
                <FlagActions flag={{ id: flag.id, name: flag.name, favorites: flag.favorites }} />
              </div>
              {flag.displayTags.length > 0 && (
                <div className='mt-5 flex flex-wrap gap-1.5'>
                  {flag.displayTags.map((tag: string) => (
                    <Tag key={tag} text={tag} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className='mx-auto max-w-[1312px] px-4 md:px-8'>
        {/* Overlaps the bottom of the band, so the header ends in the page's facts rather than empty colour. */}
        <section
          aria-label='Details'
          className={cn(
            stripClass,
            'relative z-10 -mt-11 grid-cols-2 shadow-[var(--sh-tile),0_14px_36px_-18px_rgb(0_0_0/0.3)] lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]',
          )}
        >
          <Suspense fallback={<ColoursFactSkeleton />}>
            <ColoursFact colors={colors} />
          </Suspense>
          <Fact label='Catalogue'>
            <span className='tabular-nums'>{catalogue}</span>
          </Fact>
          <Fact label='Added'>{formatDate(flag.createdAt)}</Fact>
          <Fact label='Favorites'>
            <FavoriteCount flagId={flag.id} cached={flag.favorites} />
          </Fact>
          {flag.link && sourceHost ? (
            <Fact label='Image source'>
              <a
                href={flag.link}
                target='_blank'
                rel='noopener noreferrer'
                title={flag.link}
                className='border-b border-border hover:border-foreground'
              >
                {sourceHost}
              </a>
            </Fact>
          ) : (
            <Fact label='Format'>{extension && extension.length <= 4 ? extension : 'Image'}</Fact>
          )}
        </section>

        {structured && <TraitsStrip data={structured} />}

        <Suspense fallback={<Story {...storyProps} timeline={null} />}>
          <StorySection {...storyProps} flagId={flag.id} />
        </Suspense>

        {/* Empty (and hidden) when the flag has no sources and nobody has edited it. */}
        <div className='mt-12 flex flex-wrap items-start justify-between gap-x-12 gap-y-6 border-t border-line pt-6 empty:hidden'>
          {sources.length > 0 && (
            <div className='min-w-0'>
              <h2 className='mb-2.5 text-sm font-semibold'>Sources</h2>
              <div className='flex flex-wrap gap-2'>
                {sources.map((source) => (
                  <SourceBadge key={source} source={source} />
                ))}
              </div>
            </div>
          )}
          <Suspense fallback={null}>
            <ContributorsSection flagId={flag.id} />
          </Suspense>
        </div>

        <Suspense
          fallback={
            <div className='mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className='vx-tile h-[292px] animate-pulse' />
              ))}
            </div>
          }
        >
          <RelatedFlagsSection flagId={flag.id} />
        </Suspense>
      </div>
    </>
  );
}
