import {
  getFlagDetailFromName,
  getRelatedFlags,
  getFlagEditHistory,
} from '@/actions/flags';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Clock, Eye } from '@/components/icons';
import { after } from 'next/server';
import { Button } from '@/components/ui/button';
import { notFound } from 'next/navigation';
import Contributors, { type Contributor } from './Contributors';
import FlagActions from './FlagActions';
import ExpandableDescription from './ExpandableDescription';
import FlagViewer from './FlagViewer';
import FlagViewTracker from './FlagViewTracker';
import type { FlagAiStructuredData } from '@/db/schema';
import FlagCard from '@/components/FlagCard';
import { Metadata } from 'next';
import Tag from '@/components/Tag';
import { Suspense } from 'react';
import FlagFieldsForm from '@/components/FlagFieldsForm';
import SourceBadge from '@/components/SourceBadge';
import { getFlagPalette } from '@/lib/flag-palette';
import { ensureFlagImageSelfHosted } from '@/lib/storage/flag-image-mirror';

export type RelatedFlag = {
  name: string;
  image: string;
  link: string;
};

type Props = {
  params: Promise<{ flagName: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const flagName = decodeURIComponent((await params).flagName);
  const flag = await getFlagDetailFromName(flagName);
  if (flag) {
    const pageUrl = `https://vexilo.org/flag/${encodeURIComponent(flag.name)}`;
    return {
      title: `${flag.name} - Vexilo`,
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
        title: `${flag.name} - Vexilo`,
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
        title: `${flag.name} - Vexilo`,
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

const formatMonth = (date: Date) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

const formatShare = (share: number) => (share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`);

const humanize = (value: string) =>
  value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className='vx-tile px-[22px] py-5'>
      <h2 className='mb-2 flex items-baseline gap-2 text-sm font-semibold'>
        {title}
        {aside !== undefined && <span className='tabular-nums text-[13px] font-normal text-muted-foreground'>{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

function SpecRows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className='grid grid-cols-[auto_minmax(0,1fr)] text-[13.5px]'>
      {rows.map(([k, v]) => (
        <div key={k} className='contents [&>*]:border-b [&>*]:border-line [&:last-child>*]:border-0'>
          <dt className='py-2.5 pr-6 text-muted-foreground'>{k}</dt>
          <dd className='min-w-0 truncate py-2.5 text-right'>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Colours are read from the image itself (cached), so they stream in after the page.
async function ColoursPanel({ image }: { image: string }) {
  const palette = await getFlagPalette(image);
  if (palette.length === 0) return null;
  const total = palette.reduce((sum, color) => sum + color.share, 0);
  return (
    <Panel title='Colours' aside={palette.length}>
      <div className='relative mt-1 mb-1.5 flex h-3.5 overflow-hidden rounded-full after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_0_0_1px_var(--border)]'>
        {palette.map((color) => (
          <span key={color.hex} style={{ flex: color.share / total, minWidth: 4, background: color.hex }} />
        ))}
      </div>
      <ul className='text-[13.5px]'>
        {palette.map((color) => (
          <li key={color.hex} className='flex items-center gap-2.5 border-b border-line py-2.5 last:border-0'>
            <span
              className='size-3.5 shrink-0 rounded-[4px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]'
              style={{ background: color.hex }}
            />
            <span className='flex-1'>{color.name}</span>
            <span className='tabular-nums text-muted-foreground'>
              {color.hex} · {formatShare(color.share)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function PanelSkeleton() {
  return <div className='vx-tile h-[260px] animate-pulse' />;
}

function TraitsPanel({ data }: { data: FlagAiStructuredData }) {
  const rows: [string, React.ReactNode][] = [];
  if (data.layoutType) rows.push(['Layout', humanize(data.layoutType)]);
  if (data.patternType) rows.push(['Pattern', humanize(data.patternType)]);
  if (data.primarySymbols?.length) rows.push(['Symbols', data.primarySymbols.map(humanize).join(', ')]);
  if (data.emblemPlacement && data.emblemPlacement !== 'none') rows.push(['Emblem', humanize(data.emblemPlacement)]);
  if (data.hasText !== undefined) rows.push(['Text', data.hasText ? humanize(data.textType ?? 'yes') : 'None']);
  if (rows.length === 0) return null;
  return (
    <Panel title='Traits'>
      <SpecRows rows={rows} />
    </Panel>
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
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {relatedFlags.map((relatedFlag) => (
          <FlagCard
            key={relatedFlag.id}
            id={relatedFlag.id}
            flagName={relatedFlag.name}
            flagImage={relatedFlag.image}
            sources={relatedFlag.sources}
            favorites={relatedFlag.favorites}
            isFavorite={relatedFlag.isFavorite}
            link={relatedFlag.link}
            index={relatedFlag.index}
            tags={relatedFlag.tags}
            description={relatedFlag.description}
          />
        ))}
      </div>
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
  // getFlagEditHistory caps at 20 rows.
  const totalEdits = editHistory.length >= 20 ? '20+' : String(editHistory.length);

  return (
    <div>
      <h2 className='mb-2.5 text-sm font-semibold'>Contributors</h2>
      <Contributors contributors={contributors} totalEdits={totalEdits} />
    </div>
  );
}

export default async function FlagPage({
  params,
  searchParams,
}: {
  params: Promise<{ flagName: string }>;
  searchParams: Promise<{ mode: string }>;
}) {
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

  const structured = flag.metadata?.structuredData ?? null;
  const firstTag = flag.displayTags.find((t) => t.toLowerCase() !== flag.name.toLowerCase());
  const details: [string, React.ReactNode][] = [
    ['Catalogue', <span key='i' className='tabular-nums'>#{String(flag.index).padStart(4, '0')}</span>],
    ['Views', <span key='v' className='tabular-nums'>{flag.views.toLocaleString()}</span>],
    ['Favorites', <span key='f' className='tabular-nums'>{flag.favorites}</span>],
    ['Added', formatDate(flag.createdAt)],
  ];
  if (flag.link) {
    details.push([
      'Image source',
      <a key='l' href={flag.link} target='_blank' rel='noopener noreferrer' className='border-b border-border hover:border-foreground'>
        {(() => {
          try {
            return new URL(flag.link).hostname.replace(/^www\./, '');
          } catch {
            return flag.link;
          }
        })()}
      </a>,
    ]);
  }

  return (
    <div className='mx-auto max-w-[1312px] px-4 md:px-8'>
      <FlagViewTracker flagId={flag.id} />
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

      <div className='grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10'>
        <div className='min-w-0'>
          <FlagViewer image={flag.image} name={flag.name} />
        </div>

        <div className='min-w-0 lg:pt-1'>
          <p className='text-[13px] text-muted-foreground'>
            #{String(flag.index).padStart(4, '0')}
            {firstTag ? ` · ${firstTag}` : ''}
          </p>
          <h1 className='mt-1.5 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[38px]'>
            {flag.name}
          </h1>
          {flag.displayDescription && (
            <div className='mt-4'>
              <ExpandableDescription description={flag.displayDescription} />
            </div>
          )}
          <div className='mt-4 flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-subtle [&_svg]:size-[15px] [&_svg]:text-muted-foreground'>
            <span className='flex items-center gap-1.5 tabular-nums'>
              <Eye />
              {flag.views.toLocaleString()} view{flag.views === 1 ? '' : 's'}
            </span>
            <span className='flex items-center gap-1.5'>
              <Clock />
              Added {formatMonth(flag.createdAt)}
            </span>
          </div>
          <div className='mt-5'>
            <FlagActions flag={{ ...flag, relatedFlags: [] }} />
          </div>
          {flag.displayTags.length > 0 && (
            <div className='mt-6 flex flex-wrap gap-1.5'>
              {flag.displayTags.map((tag: string) => (
                <Tag key={tag} text={tag} />
              ))}
            </div>
          )}
          <div className='mt-7 grid grid-cols-1 gap-6 border-t border-line pt-5 empty:hidden sm:grid-cols-2'>
            <Suspense fallback={null}>
              <ContributorsSection flagId={flag.id} />
            </Suspense>
            {flag.sources && flag.sources.length > 0 && (
              <div className='min-w-0'>
                <h2 className='mb-2.5 text-sm font-semibold'>Sources</h2>
                <div className='flex flex-col items-start gap-1.5'>
                  {flag.sources.map((source, index) => (
                    <SourceBadge key={`source-${index}`} source={source} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`mt-5 grid gap-4 md:grid-cols-2 ${structured ? 'lg:grid-cols-3' : ''}`}>
        <Suspense fallback={<PanelSkeleton />}>
          <ColoursPanel image={flag.image} />
        </Suspense>
        {structured && <TraitsPanel data={structured} />}
        <Panel title='Details'>
          <SpecRows rows={details} />
        </Panel>
      </div>

      <Suspense
        fallback={
          <div className='mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className='vx-tile h-[292px] animate-pulse' />
            ))}
          </div>
        }
      >
        <RelatedFlagsSection flagId={flag.id} />
      </Suspense>
    </div>
  );
}
