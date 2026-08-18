'use client';

import Image from 'next/image';
import { Flag as FlagIcon, Heart, Hash, Link2 } from 'lucide-react';
import { Flag } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const MAX_VISIBLE_TAGS = 6;

type FlagHoverPreviewProps = Pick<
  Flag,
  | 'flagName'
  | 'flagImage'
  | 'index'
  | 'tags'
  | 'description'
  | 'favorites'
  | 'sources'
  | 'relatedFlags'
>;

export default function FlagHoverPreview({
  flagName,
  flagImage,
  index,
  tags,
  description,
  favorites,
  sources,
  relatedFlags,
}: FlagHoverPreviewProps) {
  const tagList = tags ?? [];
  const visibleTags = tagList.slice(0, MAX_VISIBLE_TAGS);
  const extraTagCount = Math.max(tagList.length - MAX_VISIBLE_TAGS, 0);
  const sourceCount = sources?.length ?? 0;
  const relatedCount = relatedFlags?.length ?? 0;
  const favoriteCount = favorites ?? 0;

  return (
    <div className='flex flex-col gap-3'>
      <div className='relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-black/5 dark:bg-black/30'>
        <Image
          src={flagImage}
          alt={flagName}
          fill
          className='object-contain p-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]'
          sizes='340px'
        />
      </div>

      <div className='flex items-start justify-between gap-3'>
        <h3 className='text-lg font-bold leading-tight text-foreground line-clamp-2'>
          {flagName}
        </h3>
        <span className='mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-foreground/50'>
          <FlagIcon className='h-3.5 w-3.5' />
          Flag #{index}
        </span>
      </div>

      {visibleTags.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className='rounded-full bg-foreground/10 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80'
            >
              {tag}
            </span>
          ))}
          {extraTagCount > 0 && (
            <span className='rounded-full bg-foreground/10 px-2.5 py-0.5 text-[11px] font-medium text-foreground/50'>
              +{extraTagCount}
            </span>
          )}
        </div>
      )}

      {description ? (
        <p className='text-sm leading-snug text-foreground/70 line-clamp-3'>
          {description}
        </p>
      ) : null}

      <Separator className='bg-foreground/10' />

      <div className='grid grid-cols-2 gap-3'>
        <div>
          <p className='inline-flex items-center gap-1.5 text-base font-bold text-foreground'>
            <Heart
              className={cn(
                'h-3.5 w-3.5',
                favoriteCount > 0
                  ? 'fill-red-500 text-red-500'
                  : 'text-foreground/50',
              )}
            />
            {favoriteCount.toLocaleString()}
          </p>
          <p className='text-xs text-foreground/50'>
            {favoriteCount === 1 ? 'Favorite' : 'Favorites'}
          </p>
        </div>
        <div className='text-right'>
          {sourceCount > 0 ? (
            <>
              <p className='inline-flex items-center justify-end gap-1.5 text-base font-bold text-foreground'>
                <Link2 className='h-3.5 w-3.5 text-foreground/50' />
                {sourceCount}
              </p>
              <p className='text-xs text-foreground/50'>
                {sourceCount === 1 ? 'Source' : 'Sources'}
              </p>
            </>
          ) : (
            <>
              <p className='inline-flex items-center justify-end gap-1.5 text-base font-bold text-foreground'>
                <Hash className='h-3.5 w-3.5 text-foreground/50' />
                {tagList.length}
              </p>
              <p className='text-xs text-foreground/50'>
                {tagList.length === 1 ? 'Tag' : 'Tags'}
              </p>
            </>
          )}
        </div>
      </div>

      {relatedCount > 0 && relatedFlags ? (
        <div className='flex items-center gap-2'>
          <div className='flex -space-x-2'>
            {relatedFlags.slice(0, 4).map((relatedFlag) => (
              <span
                key={relatedFlag.id}
                className='relative h-7 w-10 overflow-hidden rounded-sm border border-foreground/15 bg-foreground/5'
              >
                <Image
                  src={relatedFlag.image}
                  alt={relatedFlag.name}
                  fill
                  className='object-cover'
                  sizes='40px'
                />
              </span>
            ))}
          </div>
          <span className='text-xs text-foreground/50'>
            {relatedCount} related {relatedCount === 1 ? 'flag' : 'flags'}
          </span>
        </div>
      ) : null}
    </div>
  );
}
