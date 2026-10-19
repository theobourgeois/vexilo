'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { FlagTimelineView } from '@/actions/flag-timeline';
import FlagImage from '@/components/FlagImage';
import { History } from '@/components/icons';
import { cn } from '@/lib/utils';

// Long timelines (Afghanistan has 20+ versions) open showing this many events.
const COLLAPSED_COUNT = 7;

const flagHref = (name: string) => `/flag/${encodeURIComponent(name)}`;

/** "fid4sa-repository.ub.uni-heidelberg.de" → "uni-heidelberg.de", "oag.gov.bt" → "oag.gov.bt", "en.wikipedia.org" → "wikipedia.org". */
function siteName(url: string) {
  try {
    const labels = new URL(url).hostname.replace(/^www\./, '').split('.');
    const secondLevel = labels.length > 2 && /^(co|com|gov|org|ac|edu|net)$/.test(labels[labels.length - 2]);
    return labels.slice(secondLevel ? -3 : -2).join('.');
  } catch {
    return url;
  }
}

/** One link per site, so two Flags of the World pages show as one "crwflags.com". */
function sourceLinks(sources: string[]) {
  const bySite = new Map<string, string>();
  for (const source of sources) if (!bySite.has(siteName(source))) bySite.set(siteName(source), source);
  return [...bySite];
}

export default function FlagTimeline({ timeline }: { timeline: FlagTimelineView }) {
  const { owner, viewingVersionId, events } = timeline;
  const [expanded, setExpanded] = useState(false);
  const collapsible = events.length > COLLAPSED_COUNT + 2;
  // Keep the version being viewed in sight even when the list is collapsed.
  const viewingIndex = events.findIndex((event) => event.versionFlagId === viewingVersionId);
  const visible =
    collapsible && !expanded
      ? events.filter((_, i) => i < COLLAPSED_COUNT || i === viewingIndex)
      : events;

  return (
    <section>
      <h2 className='flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em]'>
        <History className='size-[18px] text-muted-foreground' />
        Timeline
      </h2>
      {viewingVersionId && (
        <p className='mt-1.5 text-[13px] text-muted-foreground'>
          This flag is a former version of{' '}
          <Link href={flagHref(owner.name)} className='font-medium text-foreground hover:underline'>
            {owner.name}
          </Link>
          .
        </p>
      )}

      <ol className='mt-5'>
        {visible.map((event) => {
          const isViewing = viewingVersionId !== null && event.versionFlagId === viewingVersionId;
          return (
            <li
              key={`${event.year}-${event.title}`}
              className='group/event relative grid grid-cols-[48px_minmax(0,1fr)] gap-x-4'
            >
              <div className='pt-px text-right tabular-nums'>
                <div className='text-[14px] font-semibold'>{event.year}</div>
                {event.endYear && <div className='text-[11.5px] text-muted-foreground'>to {event.endYear}</div>}
              </div>
              <div className='relative border-l border-line pb-6 pl-5 group-last/event:border-transparent'>
                <span
                  className={cn(
                    'absolute -left-[5px] top-[6px] size-[9px] rounded-full',
                    isViewing ? 'bg-main shadow-[0_0_0_3px_var(--main-soft)]' : 'bg-muted-foreground/70',
                  )}
                />
                <div className='flex items-start gap-3'>
                  {event.version && (
                    <Link
                      href={flagHref(event.version.name)}
                      title={`Go to ${event.version.name}`}
                      className='mt-0.5 shrink-0 transition-opacity hover:opacity-80'
                    >
                      <FlagImage src={event.version.image} alt={event.version.name} maxHeight={24} fixed />
                    </Link>
                  )}
                  <div className='min-w-0'>
                    <p className='text-[14px] font-medium leading-snug'>
                      {event.title}
                      {isViewing && <span className='ml-2 text-[12px] font-medium text-main'>This flag</span>}
                    </p>
                    {event.detail && (
                      <p className='mt-1 text-[13.5px] leading-relaxed text-subtle'>{event.detail}</p>
                    )}
                    {event.sources.length > 0 && (
                      <p className='mt-1.5 truncate text-[12px] text-muted-foreground'>
                        {sourceLinks(event.sources).map(([site, source], i) => (
                          <span key={site}>
                            {i > 0 && ' · '}
                            <a href={source} target='_blank' rel='noopener noreferrer' title={source} className='hover:text-foreground'>
                              {site}
                            </a>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {viewingVersionId && (
          <li className='grid grid-cols-[48px_minmax(0,1fr)] gap-x-4'>
            <div className='pt-px text-right text-[14px] font-semibold'>Now</div>
            <div className='relative pl-5'>
              <span className='absolute -left-[5px] top-[6px] size-[9px] rounded-full bg-muted-foreground/70' />
              <Link href={flagHref(owner.name)} className='flex items-center gap-3 hover:opacity-80'>
                <FlagImage src={owner.image} alt={owner.name} maxHeight={24} fixed />
                <span className='text-[14px] font-medium'>Current flag</span>
              </Link>
            </div>
          </li>
        )}
      </ol>

      {collapsible && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className='ml-16 cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground'
        >
          {expanded ? 'Show fewer' : `Show all ${events.length} events`}
        </button>
      )}
    </section>
  );
}
