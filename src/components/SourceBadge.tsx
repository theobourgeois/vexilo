'use client';

import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
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
      className='inline-block'
    >
      <Badge
        variant='neutral'
        className='flex items-center gap-2 px-3 py-1 hover:bg-secondary cursor-pointer transition-colors'
      >
        {faviconUrl && (
          <Image
            src={faviconUrl}
            alt={`${domain} favicon`}
            width={16}
            height={16}
            className='rounded-sm'
            onError={(e) => {
              // Hide the image if favicon fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <span className='text-sm'>{domain}</span>
        <ExternalLink className='w-3 h-3' />
      </Badge>
    </a>
  );
}
