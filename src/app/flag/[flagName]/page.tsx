import {
  getFlagDetailFromName,
  getRelatedFlags,
  getFlagEditHistory,
} from '@/actions/flags';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from '@/components/icons';
import { after } from 'next/server';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { notFound } from 'next/navigation';
import FlagActions from './FlagActions';
import ExpandableDescription from './ExpandableDescription';
import FlagViewer from './FlagViewer';
import type { FlagAiStructuredData } from '@/db/schema';
import FlagCard from '@/components/FlagCard';
import { Metadata } from 'next';
import Tag from '@/components/Tag';
import { Suspense } from 'react';
import FlagFieldsForm from '@/components/FlagFieldsForm';
import SourceBadge from '@/components/SourceBadge';
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

const COLOR_HEX: Record<string, string> = {
  red: '#D52B1E',
  blue: '#1F4E9C',
  green: '#1B8A3F',
  yellow: '#F7C600',
  white: '#FFFFFF',
  black: '#111111',
  orange: '#F07C1B',
  purple: '#6A2C8F',
  brown: '#7A4B26',
  gold: '#C9A13B',
  silver: '#B9BCC0',
  maroon: '#7A1F2B',
  light_blue: '#6CACE4',
};

const humanize = (value: string) =>
  value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function Block({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className='mt-7'>
      <h2 className='mb-2.5 flex items-baseline gap-2 text-sm font-semibold'>
        {title}
        {aside !== undefined && <span className='tabular-nums text-[13px] font-normal text-muted-foreground'>{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

function SpecRows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className='grid grid-cols-[38%_1fr] text-[13.5px]'>
      {rows.map(([k, v]) => (
        <div key={k} className='contents [&>*]:border-b [&>*]:border-line'>
          <dt className='py-2.5 pr-4 text-muted-foreground'>{k}</dt>
          <dd className='min-w-0 truncate py-2.5'>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ColoursBlock({ data }: { data: FlagAiStructuredData }) {
  const colors = [...new Set([...(data.dominantColors ?? []), ...(data.secondaryColors ?? [])])];
  if (colors.length === 0) return null;
  return (
    <Block title='Colours'>
      <div className='flex flex-wrap gap-2.5'>
        {colors.map((c) => (
          <div key={c} className='vx-tile flex items-center gap-2.5 rounded-[10px] py-1.5 pl-1.5 pr-3'>
            <span
              className='size-[26px] rounded-[6px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]'
              style={{ background: COLOR_HEX[c] ?? c }}
            />
            <span className='leading-tight'>
              <span className='block text-[13px]'>{humanize(c)}</span>
              <span className='block tabular-nums text-xs text-muted-foreground'>
                {(COLOR_HEX[c] ?? c).toUpperCase()}
                {(data.dominantColors ?? []).includes(c) ? ' · dominant' : ''}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Block>
  );
}

function TraitsBlock({ data }: { data: FlagAiStructuredData }) {
  const rows: [string, React.ReactNode][] = [];
  if (data.layoutType) rows.push(['Layout', humanize(data.layoutType)]);
  if (data.patternType) rows.push(['Pattern', humanize(data.patternType)]);
  if (data.primarySymbols?.length) rows.push(['Symbols', data.primarySymbols.map(humanize).join(', ')]);
  if (data.emblemPlacement && data.emblemPlacement !== 'none') rows.push(['Emblem', humanize(data.emblemPlacement)]);
  if (data.hasText !== undefined) rows.push(['Text', data.hasText ? humanize(data.textType ?? 'yes') : 'None']);
  if (rows.length === 0) return null;
  return (
    <Block title='Traits'>
      <SpecRows rows={rows} />
    </Block>
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

// Single edit entry component
function EditHistoryEntry({
  edit,
}: {
  edit: {
    id: string;
    userName: string | null;
    userImage: string | null;
    userNumber: string;
    createdAt: Date;
  };
}) {
  return (
    <div className='flex items-center gap-3 border-b border-line py-2.5'>
      <Link href={`/profile/${edit.userNumber}`}>
        <Avatar className='size-6'>
          <AvatarImage src={edit.userImage || ''} alt={edit.userName || 'User'} />
          <AvatarFallback className='text-[10px]'>{edit.userName?.charAt(0) || 'U'}</AvatarFallback>
        </Avatar>
      </Link>
      <Link href={`/profile/${edit.userNumber}`} className='min-w-0 flex-1 truncate text-[13px] font-medium hover:underline'>
        {edit.userName || 'Unknown user'}
      </Link>
      <time className='shrink-0 tabular-nums text-[11.5px] text-muted-foreground'>
        {new Date(edit.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </time>
    </div>
  );
}

// Edit history section
async function EditHistorySection({ flagId }: { flagId: string }) {
  const editHistory = await getFlagEditHistory(flagId);

  if (!editHistory || editHistory.length === 0) {
    return null;
  }

  const initialEdits = editHistory.slice(0, 5);
  const remainingEdits = editHistory.slice(5);

  return (
    <Block title='Edit history' aside={editHistory.length}>
      <div>
        {initialEdits.map((edit) => (
          <EditHistoryEntry key={edit.id} edit={edit} />
        ))}
        {remainingEdits.length > 0 && (
          <details className='group'>
            <summary className='cursor-pointer list-none pt-2 text-center text-[13px] text-muted-foreground hover:text-foreground'>
              <span className='group-open:hidden'>
                Show {remainingEdits.length} more
              </span>
              <span className='hidden group-open:inline'>Show less</span>
            </summary>
            {remainingEdits.map((edit) => (
              <EditHistoryEntry key={edit.id} edit={edit} />
            ))}
          </details>
        )}
      </div>
    </Block>
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
    ['Favorites', <span key='f' className='tabular-nums'>{flag.favorites}</span>],
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

      <div className='grid items-start gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10'>
        <div className='min-w-0'>
          <FlagViewer image={flag.image} name={flag.name} />
          {structured && <ColoursBlock data={structured} />}
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
          <div className='mt-5'>
            <FlagActions flag={{ ...flag, relatedFlags: [] }} />
          </div>
          {flag.displayTags.length > 0 && (
            <Block title='Tags'>
              <div className='flex flex-wrap gap-1.5'>
                {flag.displayTags.map((tag: string) => (
                  <Tag key={tag} text={tag} />
                ))}
              </div>
            </Block>
          )}
          <Block title='Details'>
            <SpecRows rows={details} />
          </Block>
          {structured && <TraitsBlock data={structured} />}
          {flag.sources && flag.sources.length > 0 && (
            <Block title='Sources'>
              <div className='flex flex-wrap gap-2'>
                {flag.sources.map((source, index) => (
                  <SourceBadge key={`source-${index}`} source={source} />
                ))}
              </div>
            </Block>
          )}
          <Suspense fallback={null}>
            <EditHistorySection flagId={flag.id} />
          </Suspense>
        </div>
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
