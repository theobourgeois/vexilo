import { ChevronRight } from '@/components/icons';
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
import SourceBadge from '@/components/SourceBadge';
import { getFlagColors } from '@/lib/flag-palette';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FlagAiStructuredData } from '@/db/schema';
import FlagViewer from '../FlagViewer';

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

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function Panel({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`vx-tile px-[22px] py-5 ${className ?? ''}`}>
      <h2 className='mb-3.5 flex items-center justify-between text-sm font-semibold tracking-[-0.01em]'>
        {title}
        {aside && <span className='tabular-nums text-xs font-normal text-muted-foreground'>{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

function SpecRows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className='grid grid-cols-[auto_1fr] text-[13px]'>
      {rows.map(([k, v], i) => (
        <div key={k} className={`contents ${i < rows.length - 1 ? '[&>*]:border-b' : ''} [&>*]:border-dashed [&>*]:border-border`}>
          <dt className='py-[9px] pr-4 text-muted-foreground'>{k}</dt>
          <dd className='min-w-0 py-[9px] text-right font-medium'>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Pill({ children, quiet }: { children: React.ReactNode; quiet?: boolean }) {
  return (
    <span
      className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-medium shadow-[inset_0_0_0_1px_var(--border)] ${
        quiet ? 'text-muted-foreground' : 'text-subtle'
      }`}
    >
      {children}
    </span>
  );
}

function ColoursPanel({ data }: { data: FlagAiStructuredData }) {
  const colors = [...new Set([...(data.dominantColors ?? []), ...(data.secondaryColors ?? [])])];
  if (colors.length === 0) return null;
  return (
    <Panel title='Colours' aside={colors.length}>
      <div className='grid gap-2.5'>
        {colors.map((c) => (
          <div key={c} className='vx-well flex items-center gap-3 rounded-xl p-2'>
            <span
              className='size-9 rounded-[9px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1),inset_0_1px_0_rgb(255_255_255/0.3)]'
              style={{ background: COLOR_HEX[c] ?? c }}
            />
            <span className='text-[13px] font-semibold'>{humanize(c)}</span>
            {(data.dominantColors ?? []).includes(c) && (
              <span className='ml-auto pr-1.5 tabular-nums text-[11px] text-muted-foreground'>dominant</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TraitsPanel({ data }: { data: FlagAiStructuredData }) {
  const rows: [string, React.ReactNode][] = [];
  if (data.layoutType) rows.push(['Layout', humanize(data.layoutType)]);
  if (data.patternType) rows.push(['Pattern', humanize(data.patternType)]);
  if (data.hasText) rows.push(['Text', data.textType ? humanize(data.textType) : 'Yes']);
  if (data.emblemPlacement && data.emblemPlacement !== 'none') rows.push(['Emblem', humanize(data.emblemPlacement)]);

  const symbols = [...(data.primarySymbols ?? []), ...(data.secondarySymbols ?? [])];
  const context = [...(data.regionTags ?? []), ...(data.periodTags ?? [])];
  if (rows.length === 0 && symbols.length === 0 && context.length === 0) return null;

  return (
    <Panel title='Traits'>
      {rows.length > 0 && <SpecRows rows={rows} />}
      {symbols.length > 0 && (
        <div className='mt-4 border-t border-line pt-4 first:mt-0 first:border-0 first:pt-0'>
          <span className='vx-label'>Symbols</span>
          <div className='mt-2.5 flex flex-wrap gap-1.5'>
            {data.primarySymbols?.map((s) => <Pill key={`p-${s}`}>{humanize(s)}</Pill>)}
            {data.secondarySymbols?.map((s) => (
              <Pill key={`s-${s}`} quiet>
                {humanize(s)}
              </Pill>
            ))}
          </div>
        </div>
      )}
      {context.length > 0 && (
        <div className='mt-4 border-t border-line pt-4 first:mt-0 first:border-0 first:pt-0'>
          <span className='vx-label'>Context</span>
          <div className='mt-2.5 flex flex-wrap gap-1.5'>
            {data.regionTags?.map((r) => <Pill key={`r-${r}`}>{humanize(r)}</Pill>)}
            {data.periodTags?.map((p) => (
              <Pill key={`t-${p}`} quiet>
                {humanize(p)}
              </Pill>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
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
  const sources = (aiMetadata.researchSources ?? []).filter((source) => !!source.url);
  const catalogue = `#${String(flag.index).padStart(4, '0')}`;

  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-16 md:px-8'>
      <nav className='flex items-center gap-2 pb-4 pt-[22px] text-[13px] text-muted-foreground'>
        <Link href='/' className='hover:text-foreground'>
          Browse
        </Link>
        <ChevronRight className='size-3' />
        <Link href='/experimental/search' className='hover:text-foreground'>
          Smart search
        </Link>
        <ChevronRight className='size-3' />
        <span className='truncate font-medium text-foreground'>{flag.name}</span>
      </nav>

      <div className='grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]'>
        <FlagViewer image={flag.image} name={flag.name} palette={getFlagColors(flag)} />

        <section className='vx-tile flex flex-col p-6 sm:p-[26px]'>
          <span className='vx-label'>{catalogue} · Experimental</span>
          <h1 className='mt-2.5 text-[32px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[40px]'>
            {flag.name}
          </h1>
          {headline && (
            <p className='mt-4 text-[15px] leading-relaxed text-subtle'>{headline}</p>
          )}
          {sources.length > 0 && (
            <div className='mt-auto border-t border-line pt-5 [&:not(:first-child)]:mt-5'>
              <span className='vx-label'>Research sources</span>
              <div className='mt-3 flex flex-wrap gap-2'>
                <TooltipProvider delayDuration={200}>
                  {sources.map((source, index) => (
                    <Tooltip key={`source-${index}`}>
                      <TooltipTrigger asChild>
                        <div className='inline-block'>
                          <SourceBadge source={source.url!} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side='bottom' className='max-w-[280px] p-3'>
                        <div className='flex flex-col gap-1.5'>
                          <div className='flex items-center justify-between gap-4 tabular-nums text-xs text-background/60'>
                            <span>{source.type}</span>
                            {source.provider && <span>{source.provider}</span>}
                          </div>
                          {source.title && (
                            <strong className='line-clamp-2 text-[13px] font-semibold leading-tight'>
                              {source.title}
                            </strong>
                          )}
                          {source.notes && (
                            <p className='line-clamp-3 text-xs leading-relaxed text-background/70'>
                              {source.notes}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className='mt-4 grid items-start gap-4 lg:grid-cols-3'>
        {(hasHistory || hasDesign) && (
          <div className='grid gap-4 lg:col-span-2'>
            {hasHistory && (
              <Panel title='History'>
                <p className='max-w-[68ch] text-[14px] leading-[1.7] text-subtle'>
                  {aiMetadata.historicalContext}
                </p>
              </Panel>
            )}
            {hasDesign && (
              <Panel title='Design and symbolism'>
                <div className='max-w-[68ch] space-y-3.5 text-[14px] leading-[1.7] text-subtle'>
                  {aiMetadata.visualDescription && <p>{aiMetadata.visualDescription}</p>}
                  {aiMetadata.detailedDescription && <p>{aiMetadata.detailedDescription}</p>}
                </div>
              </Panel>
            )}
          </div>
        )}
        {structured && (
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-1'>
            <ColoursPanel data={structured} />
            <TraitsPanel data={structured} />
          </div>
        )}
      </div>

      {relatedFlags && relatedFlags.length > 0 && (
        <section className='mt-10'>
          <h2 className='mb-4 text-[17px] font-semibold tracking-[-0.02em]'>Recommended flags</h2>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
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
