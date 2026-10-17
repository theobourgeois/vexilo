'use client';

import { ExternalLink } from '@/components/icons';
import { extractDomain, getFaviconUrl } from '@/lib/utils';
import Image from 'next/image';

interface SourceBadgeProps {
  source: string;
}

export default function SourceBadge({ source }: SourceBadgeProps) {
  const domain = extractDomain(source);
  const faviconUrl = getFaviconUrl(source);

  return (
    <a
      href={source}
      target='_blank'
      rel='noopener noreferrer'
      title={source}
      className='vx-key inline-flex h-7 max-w-full items-center gap-2 rounded-full px-2.5 text-[12.5px] font-medium text-subtle transition-[transform,color] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    >
      {faviconUrl && (
        <Image
          src={faviconUrl}
          alt=''
          width={14}
          height={14}
          className='shrink-0 rounded-[3px]'
          onError={(e) => {
            // Hide the image if favicon fails to load
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <span className='truncate'>{domain}</span>
      <ExternalLink className='size-3 shrink-0 text-muted-foreground' />
    </a>
  );
}
