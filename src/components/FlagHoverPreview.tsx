'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Flag as FlagIcon, Heart, Hash, Link2 } from 'lucide-react';
import { KeyboardEvent, MouseEvent } from 'react';
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
> & {
  onNavigate: () => void;
  onClose: () => void;
};

function PreviewTag({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isActive = searchParams.get('tag') === text;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const params = new URLSearchParams(searchParams);
    params.set('tag', text);

    if (window.location.pathname !== '/') {
      router.push(`/?${params.toString()}`);
      onClose();
      return;
    }

    router.replace(`${window.location.pathname}?${params.toString()}`, {
      scroll: false,
    });
    onClose();
  };

  return (
    <button
      type='button'
      onClick={handleClick}
      aria-label={`Filter by tag ${text}`}
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
        isActive
          ? 'bg-main text-main-foreground'
          : 'bg-white/10 text-white/90 hover:bg-white/20',
      )}
    >
      {text}
    </button>
  );
}

export default function FlagHoverPreview({
  flagName,
  flagImage,
  index,
  tags,
  description,
  favorites,
  sources,
  relatedFlags,
  onNavigate,
  onClose,
}: FlagHoverPreviewProps) {
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const extraTagCount = Math.max(tags.length - MAX_VISIBLE_TAGS, 0);
  const sourceCount = sources?.length ?? 0;
  const relatedCount = relatedFlags?.length ?? 0;
  const favoriteCount = favorites ?? 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onNavigate();
    }
  };

  return (
    <div
      role='link'
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={handleKeyDown}
      className='flex cursor-pointer flex-col gap-3 outline-none'
    >
      <div className='relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-black/30'>
        <Image
          src={flagImage}
          alt={flagName}
          fill
          className='object-contain p-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]'
          sizes='340px'
        />
      </div>

      <div className='flex items-start justify-between gap-3'>
        <h3 className='text-lg font-bold leading-tight text-white line-clamp-2'>
          {flagName}
        </h3>
        <span className='mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-white/50'>
          <FlagIcon className='h-3.5 w-3.5' />
          Flag #{index}
        </span>
      </div>

      {visibleTags.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {visibleTags.map((tag) => (
            <PreviewTag key={tag} text={tag} onClose={onClose} />
          ))}
          {extraTagCount > 0 && (
            <span className='rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/70'>
              +{extraTagCount}
            </span>
          )}
        </div>
      )}

      {description ? (
        <p className='text-sm leading-snug text-white/70 line-clamp-3'>
          {description}
        </p>
      ) : null}

      <Separator className='bg-white/10' />

      <div className='grid grid-cols-2 gap-3'>
        <div>
          <p className='inline-flex items-center gap-1.5 text-base font-bold text-white'>
            <Heart
              className={cn(
                'h-3.5 w-3.5',
                favoriteCount > 0
                  ? 'fill-red-500 text-red-500'
                  : 'text-white/50',
              )}
            />
            {favoriteCount.toLocaleString()}
          </p>
          <p className='text-xs text-white/50'>
            {favoriteCount === 1 ? 'Favorite' : 'Favorites'}
          </p>
        </div>
        <div className='text-right'>
          {sourceCount > 0 ? (
            <>
              <p className='inline-flex items-center justify-end gap-1.5 text-base font-bold text-white'>
                <Link2 className='h-3.5 w-3.5 text-white/50' />
                {sourceCount}
              </p>
              <p className='text-xs text-white/50'>
                {sourceCount === 1 ? 'Source' : 'Sources'}
              </p>
            </>
          ) : (
            <>
              <p className='inline-flex items-center justify-end gap-1.5 text-base font-bold text-white'>
                <Hash className='h-3.5 w-3.5 text-white/50' />
                {tags.length}
              </p>
              <p className='text-xs text-white/50'>
                {tags.length === 1 ? 'Tag' : 'Tags'}
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
                className='relative h-7 w-10 overflow-hidden rounded-sm border border-white/20 bg-black/40'
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
          <span className='text-xs text-white/50'>
            {relatedCount} related {relatedCount === 1 ? 'flag' : 'flags'}
          </span>
        </div>
      ) : null}
    </div>
  );
}
