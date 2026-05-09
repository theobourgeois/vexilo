import {
  getFlagDetailFromName,
  getRelatedFlags,
  getFlagEditHistory,
} from '@/actions/flags';
import Image from 'next/image';
import Link from 'next/link';
import {
  ExternalLink,
  Flag,
  Star,
  Eye,
  ArrowLeft,
  History,
  BookOpen,
  Palette,
  Globe,
  Sparkles,
} from 'lucide-react';
import { after } from 'next/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { notFound } from 'next/navigation';
import FlagActions from './FlagActions';
import ExpandableDescription from './ExpandableDescription';
import FlagCard from '@/components/FlagCard';
import { Metadata } from 'next';
import Tag from '@/components/Tag';
import { Suspense } from 'react';
import FlagFieldsForm from '@/components/FlagFieldsForm';
import SourceBadge from '@/components/SourceBadge';
import { ensureFlagImageSelfHosted } from '@/lib/storage/flag-image-mirror';
import type { FlagAiResearchSource, FlagAiStructuredData } from '@/db/schema';

export type RelatedFlag = {
  name: string;
  image: string;
  link: string;
};

type Props = {
  params: Promise<{ flagName: string }>;
};

const COLOR_SWATCHES: Record<string, string> = {
  red: '#dc2626',
  blue: '#2563eb',
  green: '#16a34a',
  yellow: '#facc15',
  white: '#ffffff',
  black: '#0a0a0a',
  orange: '#f97316',
  purple: '#9333ea',
  brown: '#92400e',
  gold: '#d4a017',
  silver: '#c0c0c0',
  maroon: '#7f1d1d',
  light_blue: '#7dd3fc',
};

function humanize(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

function MetadataProfileCard({
  structured,
}: {
  structured: FlagAiStructuredData | null | undefined;
}) {
  if (!structured) {
    return null;
  }

  const hasContextBadges =
    (structured.regionTags?.length ?? 0) > 0 ||
    (structured.periodTags?.length ?? 0) > 0 ||
    (structured.styleTags?.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Sparkles className='w-5 h-5' />
          Flag Metadata Profile
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        {structured.dominantColors && structured.dominantColors.length > 0 && (
          <div>
            <h3 className='mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
              Palette
            </h3>
            <div className='flex flex-wrap gap-2.5'>
              {structured.dominantColors.map((color) => {
                const isWhite = color === 'white';
                return (
                  <div
                    key={color}
                    className='flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 py-1.5 pl-1.5 pr-3.5'
                  >
                    <span
                      className={`h-4 w-4 rounded-full shadow-sm ${
                        isWhite ? 'border border-border/80' : ''
                      }`}
                      style={{ backgroundColor: COLOR_SWATCHES[color] || '#ccc' }}
                      aria-hidden
                    />
                    <span className='text-sm font-medium capitalize leading-none'>
                      {humanize(color)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h3 className='mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
            Structure
          </h3>
          <ul className='space-y-2.5 text-sm'>
            {structured.layoutType && (
              <li className='flex items-center justify-between gap-4'>
                <span className='text-muted-foreground'>Layout</span>
                <span className='font-medium'>{humanize(structured.layoutType)}</span>
              </li>
            )}
            {structured.patternType && (
              <li className='flex items-center justify-between gap-4'>
                <span className='text-muted-foreground'>Pattern</span>
                <span className='font-medium'>{humanize(structured.patternType)}</span>
              </li>
            )}
            {typeof structured.hasText === 'boolean' && structured.hasText && (
              <li className='flex items-center justify-between gap-4'>
                <span className='text-muted-foreground'>Text</span>
                <span className='font-medium'>
                  {structured.textType ? humanize(structured.textType) : 'Yes'}
                </span>
              </li>
            )}
            {structured.emblemPlacement &&
              structured.emblemPlacement !== 'none' && (
                <li className='flex items-center justify-between gap-4'>
                  <span className='text-muted-foreground'>Emblem</span>
                  <span className='font-medium'>
                    {humanize(structured.emblemPlacement)}
                  </span>
                </li>
              )}
          </ul>
        </div>

        {structured.primarySymbols && structured.primarySymbols.length > 0 && (
          <div>
            <h3 className='mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
              Symbols
            </h3>
            <div className='flex flex-wrap gap-2'>
              {structured.primarySymbols.map((symbol) => (
                <Badge key={symbol} variant='neutral' className='bg-muted/50 font-medium'>
                  {humanize(symbol)}
                </Badge>
              ))}
              {structured.secondarySymbols?.map((symbol) => (
                <Badge
                  key={symbol}
                  variant='neutral'
                  className='bg-transparent font-normal opacity-70'
                >
                  {humanize(symbol)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {hasContextBadges && (
          <div>
            <h3 className='mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
              Context
            </h3>
            <div className='flex flex-wrap gap-2'>
              {structured.regionTags?.map((tag) => (
                <Badge key={tag} variant='neutral' className='font-medium'>
                  {humanize(tag)}
                </Badge>
              ))}
              {structured.periodTags?.map((tag) => (
                <Badge
                  key={tag}
                  variant='neutral'
                  className='bg-transparent font-normal text-muted-foreground'
                >
                  {humanize(tag)}
                </Badge>
              ))}
              {structured.styleTags?.map((tag) => (
                <Badge key={tag} variant='neutral' className='bg-muted/50'>
                  {humanize(tag)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetadataResearchCard({
  sources,
}: {
  sources: FlagAiResearchSource[] | null | undefined;
}) {
  const validSources = sources?.filter((source) => source.url) ?? [];

  if (validSources.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Globe className='w-5 h-5' />
          Metadata Research
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {validSources.map((source, index) => (
          <div key={`${source.url}-${index}`} className='rounded-lg border border-border/50 p-4'>
            <div className='flex flex-wrap items-center gap-2 mb-2'>
              <Badge variant='neutral' className='uppercase tracking-wide text-[10px]'>
                {source.type}
              </Badge>
              {source.provider && (
                <span className='text-xs text-muted-foreground'>{source.provider}</span>
              )}
            </div>
            <Link
              href={source.url!}
              target='_blank'
              rel='noopener noreferrer'
              className='font-medium hover:underline break-all'
            >
              {source.title || source.url}
            </Link>
            {source.notes && (
              <p className='mt-2 text-sm text-muted-foreground'>{source.notes}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

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

// Separate component for related flags to enable streaming
async function RelatedFlagsSection({ flagId }: { flagId: string }) {
  const relatedFlags = await getRelatedFlags(flagId);

  if (!relatedFlags || relatedFlags.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Star className='w-5 h-5' />
          Related Flags
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
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
      </CardContent>
    </Card>
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
    <div className='flex items-center gap-3 py-2 border-b border-border/50 last:border-0'>
      <Link href={`/profile/${edit.userNumber}`}>
        <Avatar className='w-6 h-6'>
          <AvatarImage src={edit.userImage || ''} alt={edit.userName || 'User'} />
          <AvatarFallback className='text-xs'>
            {edit.userName?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className='flex-1 min-w-0'>
        <Link
          href={`/profile/${edit.userNumber}`}
          className='text-sm font-medium hover:underline'
        >
          {edit.userName || 'Unknown User'}
        </Link>
        <span className='text-sm text-muted-foreground ml-2'>edited this flag</span>
      </div>
      <time className='text-xs text-muted-foreground whitespace-nowrap'>
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
  const hasMore = remainingEdits.length > 0;

  return (
    <Card className='mt-8'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base font-medium text-muted-foreground'>
          <History className='w-4 h-4' />
          Edit History
        </CardTitle>
      </CardHeader>
      <CardContent className='pt-0'>
        <div className='space-y-2'>
          {initialEdits.map((edit) => (
            <EditHistoryEntry key={edit.id} edit={edit} />
          ))}
          {hasMore && (
            <details className='group'>
              <summary className='flex items-center justify-center py-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer list-none'>
                <span className='group-open:hidden'>
                  Show {remainingEdits.length} more edit{remainingEdits.length > 1 ? 's' : ''}
                </span>
                <span className='hidden group-open:inline'>Show less</span>
              </summary>
              <div className='space-y-2'>
                {remainingEdits.map((edit) => (
                  <EditHistoryEntry key={edit.id} edit={edit} />
                ))}
              </div>
            </details>
          )}
        </div>
      </CardContent>
    </Card>
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
      <div className='container mx-auto px-4 py-8 max-w-6xl'>
        <div className='flex justify-between items-center mb-8'>
          <h1 className='text-4xl md:text-5xl font-bold tracking-tight'>
            Edit Flag
          </h1>
          <Link
            className='flex items-center gap-2'
            href={`/flag/${encodeURIComponent(flag.name)}`}
          >
            <Button>
              <ArrowLeft className='w-4 h-4 mr-2' />
              Back
            </Button>
          </Link>
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

  return (
    <div className='container mx-auto px-4 py-8 max-w-6xl'>
      {/* Header */}
      <div className='text-center space-y-4 mb-8'>
        <Badge variant='neutral' className='mb-2 gap-2 pl-1.5 pr-3'>
          <span className='relative inline-block w-5 h-3.5 rounded-[2px] overflow-hidden border border-border/60'>
            <Image src={flag.image} alt={`${flag.name} flag`} fill className='object-cover' sizes='20px' />
          </span>
          Flag #{flag.index}
        </Badge>
        <h1 className='text-4xl md:text-5xl font-bold tracking-tight'>{flag.name}</h1>
        {/* Tags before description */}
        {flag.displayTags.length > 0 && (
          <div className='flex flex-wrap gap-2 justify-center mb-2'>
            {flag.displayTags.map((tag: string) => (
              <Tag key={tag} text={tag} />
            ))}
          </div>
        )}
        {flag.displayDescription && (
          <ExpandableDescription description={flag.displayDescription} />
        )}
        {/* Sources */}
        {flag.sources && flag.sources.length > 0 && (
          <div className='flex flex-wrap gap-2 justify-center mt-4'>
            {flag.sources.map((source, index) => (
              <SourceBadge key={`source-${index}`} source={source} />
            ))}
          </div>
        )}
      </div>

      {/* Actions - positioned prominently below header */}
      <div className='flex justify-center mb-8'>
        <FlagActions
          flag={{
            ...flag,
            relatedFlags: [], // We'll load related flags separately
          }}
        />
      </div>

      {/* Flag Display - Full Width */}
      <Card className='mb-8'>
        <CardContent className='p-6'>
          <div className='relative aspect-[3/2] md:w-3/4 mx-auto w-full rounded-lg overflow-hidden'>
            <Image
              src={flag.image}
              alt={flag.name}
              fill
              className='object-contain'
              sizes='(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw'
            />
          </div>
        </CardContent>
      </Card>

      {/* View Options */}
      <Card className='mb-8'>
        <CardHeader>
          <CardTitle className='text-center flex items-center justify-center gap-2'>
            <Eye className='w-5 h-5' />
            View Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid sm:grid-cols-2 gap-4'>
            <Button asChild variant='neutral' size='lg'>
              <Link href={flag.image} target='_blank' rel='noopener noreferrer'>
                <ExternalLink className='w-4 h-4 mr-2' />
                Full Size Image
              </Link>
            </Button>
            <Button asChild variant='neutral' size='lg'>
              <Link
                href={`https://krikienoid.github.io/flagwaver/#?src=${encodeURIComponent(
                  flag.image,
                )}`}
                target='_blank'
                rel='noopener noreferrer'
              >
                <Flag className='w-4 h-4 mr-2' />
                Flag Waver
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {(flag.metadata?.historicalContext ||
        flag.metadata?.visualDescription ||
        flag.metadata?.detailedDescription ||
        (flag.metadata?.metaTags?.length ?? 0) > 0 ||
        flag.metadata?.structuredData ||
        (flag.metadata?.researchSources?.length ?? 0) > 0) && (
        <div className='grid gap-8 lg:grid-cols-3 mb-8'>
          <div className='space-y-8 lg:col-span-2'>
            {flag.metadata?.historicalContext && (
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <BookOpen className='w-5 h-5' />
                    Historical Context
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='leading-7 text-muted-foreground'>
                    {flag.metadata.historicalContext}
                  </p>
                </CardContent>
              </Card>
            )}

            {(flag.metadata?.visualDescription ||
              flag.metadata?.detailedDescription) && (
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Palette className='w-5 h-5' />
                    Design & Symbolism
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {flag.metadata?.visualDescription && (
                    <p className='leading-7 text-muted-foreground'>
                      {flag.metadata.visualDescription}
                    </p>
                  )}
                  {flag.metadata?.detailedDescription && (
                    <p className='leading-7 text-muted-foreground'>
                      {flag.metadata.detailedDescription}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <MetadataResearchCard sources={flag.metadata?.researchSources} />
          </div>

          <div className='space-y-8'>
            {flag.metadata?.metaTags && flag.metadata.metaTags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Metadata Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='flex flex-wrap gap-2'>
                    {flag.metadata.metaTags.map((tag) => (
                      <Badge key={tag} variant='neutral'>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <MetadataProfileCard structured={flag.metadata?.structuredData} />

            <Card>
              <CardHeader>
                <CardTitle>Flag Properties</CardTitle>
              </CardHeader>
              <CardContent className='space-y-5'>
                <div>
                  <h3 className='mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                    Record Description
                  </h3>
                  <p className='text-sm leading-6 text-muted-foreground'>
                    {flag.description || 'No description saved on the flag record yet.'}
                  </p>
                </div>

                <div>
                  <h3 className='mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                    Record Tags
                  </h3>
                  <div className='flex flex-wrap gap-2'>
                    {flag.tags.length > 0 ? (
                      flag.tags.map((tag) => <Tag key={tag} text={tag} />)
                    ) : (
                      <p className='text-sm text-muted-foreground'>
                        No tags saved on the flag record yet.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className='mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                    Sources
                  </h3>
                  <div className='flex flex-wrap gap-2'>
                    {flag.sources.length > 0 ? (
                      flag.sources.map((source, index) => (
                        <SourceBadge key={`property-source-${index}`} source={source} />
                      ))
                    ) : (
                      <p className='text-sm text-muted-foreground'>
                        No sources saved on the flag record yet.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className='mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                    External Link
                  </h3>
                  <Link
                    href={flag.link}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-sm hover:underline break-all'
                  >
                    {flag.link}
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Related Flags - Loaded separately for better performance */}
      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Star className='w-5 h-5' />
                Related Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={`skeleton-${Date.now()}-${i}`}
                    className='h-48 bg-muted animate-pulse rounded-lg'
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        }
      >
        <RelatedFlagsSection flagId={flag.id} />
      </Suspense>

      {/* Edit History */}
      <Suspense fallback={null}>
        <EditHistorySection flagId={flag.id} />
      </Suspense>
    </div>
  );
}
