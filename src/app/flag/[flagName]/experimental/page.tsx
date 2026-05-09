import {
  FaBookOpen as BookOpen,
  FaArrowUpRightFromSquare as ExternalLink,
  FaFlag as Flag,
  FaPalette as Palette,
  FaArrowLeft as ArrowLeft,
  FaGlobe as Globe,
} from 'react-icons/fa6';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { after } from 'next/server';

import {
  getExperimentalRecommendedFlags,
  getFlagFromName,
} from '@/actions/flags';
import { getFlagAiMetadata } from '@/actions/flag-ai-metadata';
import FlagCard from '@/components/FlagCard';
import { ensureFlagImageSelfHosted } from '@/lib/storage/flag-image-mirror';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SourceBadge from '@/components/SourceBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Props = {
  params: Promise<{ flagName: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const flagName = decodeURIComponent((await params).flagName);
  const flag = await getFlagFromName(flagName);
  if (!flag) notFound();

  const aiMetadata = await getFlagAiMetadata(flag.id);
  if (!aiMetadata) notFound();

  const description =
    aiMetadata.descriptionDraft?.trim() ||
    `Discover the history, design, and symbolism of the flag of ${flag.name}.`;

  return {
    title: `${flag.name} - Vexilo`,
    description,
  };
}

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

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export default async function ConsumerFlagPage({ params }: Props) {
  const { flagName: rawName } = await params;
  const flagName = decodeURIComponent(rawName);
  const flag = await getFlagFromName(flagName);

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

  const [aiMetadata, relatedFlags] = await Promise.all([
    getFlagAiMetadata(flag.id),
    getExperimentalRecommendedFlags(flag.id),
  ]);

  if (!aiMetadata) {
    notFound();
  }

  const structured = aiMetadata.structuredData;
  const headline = aiMetadata.descriptionDraft?.trim() ?? '';
  const hasHistory = !!aiMetadata.historicalContext;
  const hasDesign = !!(
    aiMetadata.visualDescription || aiMetadata.detailedDescription
  );

  return (
    <div className='min-h-screen bg-background pb-20'>
      {/* Navbar / Back */}
      <div className='border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='container mx-auto flex h-14 max-w-6xl items-center px-4'>
          <Link
            href='/experimental/search'
            className='inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to search
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <section className='relative border-b border-border/40 bg-muted/20 pt-16 pb-20 sm:pt-24 sm:pb-32'>
        <div className='container mx-auto flex max-w-4xl flex-col items-center px-4'>
          <div className='relative w-full max-w-3xl overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl transition-transform duration-500 hover:scale-[1.01]'>
            <div className='relative aspect-[3/2] w-full'>
              <Image
                src={flag.image}
                alt={flag.name}
                fill
                className='object-cover'
                sizes='(max-width: 1200px) 100vw, 1200px'
                priority
              />
            </div>
          </div>

          <div className='mt-12 max-w-2xl text-center md:mt-16'>
            <h1 className='mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl'>
              {flag.name}
            </h1>
            {headline && (
              <p className='text-lg leading-relaxed text-muted-foreground sm:text-xl'>
                {headline}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Article Body */}
      <section className='container mx-auto mt-16 max-w-5xl px-4'>
        <div className='grid gap-12 lg:grid-cols-12 lg:gap-16'>
          {/* Main Content Column */}
          <div className='space-y-16 lg:col-span-8'>
            {hasHistory && (
              <article>
                <div className='mb-6 flex items-center gap-3'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
                    <BookOpen className='h-5 w-5 text-foreground/80' />
                  </div>
                  <h2 className='text-2xl font-bold tracking-tight'>
                    The History
                  </h2>
                </div>
                <div className='prose prose-lg dark:prose-invert max-w-none text-foreground/90'>
                  <p className='leading-relaxed'>
                    {aiMetadata.historicalContext}
                  </p>
                </div>
              </article>
            )}

            {hasDesign && (
              <article>
                <div className='mb-6 flex items-center gap-3'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
                    <Palette className='h-5 w-5 text-foreground/80' />
                  </div>
                  <h2 className='text-2xl font-bold tracking-tight'>
                    Design & Symbolism
                  </h2>
                </div>
                <div className='prose prose-lg dark:prose-invert max-w-none space-y-6 text-foreground/90'>
                  {aiMetadata.visualDescription && (
                    <p className='leading-relaxed'>
                      {aiMetadata.visualDescription}
                    </p>
                  )}
                  {aiMetadata.detailedDescription && (
                    <p className='leading-relaxed'>
                      {aiMetadata.detailedDescription}
                    </p>
                  )}
                </div>
              </article>
            )}

            {aiMetadata.researchSources &&
              aiMetadata.researchSources.length > 0 && (
                <article className='pt-8'>
                  <div className='mb-6 flex items-center gap-3 border-t border-border/50 pt-12'>
                    <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
                      <Globe className='h-5 w-5 text-foreground/80' />
                    </div>
                    <h2 className='text-2xl font-bold tracking-tight'>
                      Sources & Research
                    </h2>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <TooltipProvider delayDuration={200}>
                      {aiMetadata.researchSources.map((source, index) => {
                        if (!source.url) return null;
                        return (
                          <Tooltip key={`source-${index}`}>
                            <TooltipTrigger asChild>
                              <div className='inline-block cursor-pointer'>
                                <SourceBadge source={source.url} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side='bottom'
                              className='max-w-[280px] p-3 shadow-lg'
                            >
                              <div className='flex flex-col gap-2'>
                                <div className='flex items-center justify-between gap-4 border-b border-background/20 pb-2'>
                                  <Badge
                                    variant='neutral'
                                    className='text-[10px] uppercase tracking-wide bg-background/10 text-background border-none shadow-none'
                                  >
                                    {source.type}
                                  </Badge>
                                  {source.provider && (
                                    <span className='text-[10px] uppercase tracking-wide text-background/60'>
                                      {source.provider}
                                    </span>
                                  )}
                                </div>
                                {source.title && (
                                  <strong className='text-sm font-semibold leading-tight mt-1 line-clamp-2 text-background'>
                                    {source.title}
                                  </strong>
                                )}
                                {source.notes && (
                                  <p className='text-xs text-background/70 leading-relaxed line-clamp-3'>
                                    {source.notes}
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </div>
                </article>
              )}
          </div>

          {/* Sidebar */}
          <aside className='space-y-8 lg:col-span-4'>
            {/* Quick Actions */}
            <div className='flex flex-col gap-3'>
              <Button
                asChild
                size='lg'
                className='h-14 w-full justify-start text-base shadow-sm'
              >
                <Link
                  href={`https://krikienoid.github.io/flagwaver/#?src=${encodeURIComponent(flag.image)}`}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <Flag className='mr-3 h-5 w-5 opacity-80' />
                  See it wave
                </Link>
              </Button>
              <Button
                asChild
                variant='neutral'
                size='lg'
                className='h-14 w-full justify-start text-base shadow-sm'
              >
                <Link
                  href={flag.image}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <ExternalLink className='mr-3 h-5 w-5 opacity-80' />
                  Full size image
                </Link>
              </Button>
            </div>

            {/* Flag Profile Card */}
            {structured && (
              <div className='overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm'>
                <div className='border-b border-border/50 bg-muted/20 px-6 py-4'>
                  <h3 className='font-semibold tracking-tight'>Flag Profile</h3>
                </div>

                <div className='space-y-8 p-6'>
                  {/* Colors */}
                  {structured.dominantColors &&
                    structured.dominantColors.length > 0 && (
                      <div>
                        <h4 className='mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                          Palette
                        </h4>
                        <div className='flex flex-wrap gap-2.5'>
                          {structured.dominantColors.map((c) => {
                            const isWhite = c === 'white';
                            return (
                              <div
                                key={c}
                                className='flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 py-1.5 pl-1.5 pr-3.5 transition-colors hover:bg-muted/50'
                              >
                                <span
                                  className={`h-4 w-4 rounded-full shadow-sm ${
                                    isWhite ? 'border border-border/80' : ''
                                  }`}
                                  style={{
                                    backgroundColor:
                                      COLOR_SWATCHES[c] || '#ccc',
                                  }}
                                  aria-hidden
                                />
                                <span className='text-sm font-medium capitalize leading-none'>
                                  {humanize(c)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {/* Structure */}
                  <div>
                    <h4 className='mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                      Structure
                    </h4>
                    <ul className='space-y-2.5 text-sm'>
                      {structured.layoutType && (
                        <li className='flex items-center justify-between'>
                          <span className='text-muted-foreground'>Layout</span>
                          <span className='font-medium'>
                            {humanize(structured.layoutType)}
                          </span>
                        </li>
                      )}
                      {structured.patternType && (
                        <li className='flex items-center justify-between'>
                          <span className='text-muted-foreground'>Pattern</span>
                          <span className='font-medium'>
                            {humanize(structured.patternType)}
                          </span>
                        </li>
                      )}
                      {structured.hasText && (
                        <li className='flex items-center justify-between'>
                          <span className='text-muted-foreground'>Text</span>
                          <span className='font-medium'>
                            {structured.textType
                              ? humanize(structured.textType)
                              : 'Yes'}
                          </span>
                        </li>
                      )}
                      {structured.emblemPlacement &&
                        structured.emblemPlacement !== 'none' && (
                          <li className='flex items-center justify-between'>
                            <span className='text-muted-foreground'>
                              Emblem
                            </span>
                            <span className='font-medium'>
                              {humanize(structured.emblemPlacement)}
                            </span>
                          </li>
                        )}
                    </ul>
                  </div>

                  {/* Symbols */}
                  {structured.primarySymbols &&
                    structured.primarySymbols.length > 0 && (
                      <div>
                        <h4 className='mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                          Symbols
                        </h4>
                        <div className='flex flex-wrap gap-2'>
                          {structured.primarySymbols.map((s) => (
                            <Badge
                              key={s}
                              variant='neutral'
                              className='bg-muted/50 font-medium'
                            >
                              {humanize(s)}
                            </Badge>
                          ))}
                          {structured.secondarySymbols?.map((s) => (
                            <Badge
                              key={s}
                              variant='neutral'
                              className='bg-transparent font-normal opacity-70'
                            >
                              {humanize(s)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Region & Period */}
                  {((structured.regionTags &&
                    structured.regionTags.length > 0) ||
                    (structured.periodTags &&
                      structured.periodTags.length > 0)) && (
                    <div>
                      <h4 className='mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                        Context
                      </h4>
                      <div className='flex flex-wrap gap-2'>
                        {structured.regionTags?.map((r) => (
                          <Badge
                            key={r}
                            variant='neutral'
                            className='font-medium'
                          >
                            {humanize(r)}
                          </Badge>
                        ))}
                        {structured.periodTags?.map((p) => (
                          <Badge
                            key={p}
                            variant='neutral'
                            className='bg-transparent font-normal text-muted-foreground'
                          >
                            {humanize(p)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* Recommendations Section */}
      {relatedFlags && relatedFlags.length > 0 && (
        <section className='container mx-auto mt-24 max-w-5xl px-4 border-t border-border/40 pt-16'>
          <h2 className='text-3xl font-bold tracking-tight mb-8 text-center sm:text-left'>
            Recommended Flags
          </h2>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
            {relatedFlags.map((relatedFlag) => (
              <FlagCard
                key={relatedFlag.id}
                id={relatedFlag.id}
                flagName={relatedFlag.name}
                flagImage={relatedFlag.image}
                link={relatedFlag.link}
                index={relatedFlag.index}
                tags={relatedFlag.tags}
                description={relatedFlag.description}
                favorites={relatedFlag.favorites}
                isFavorite={relatedFlag.isFavorite}
                sources={relatedFlag.sources}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
