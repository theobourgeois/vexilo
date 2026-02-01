import {
  getFlagFromName,
  getRelatedFlags,
  getFlagEditHistory,
} from '@/actions/flags';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, Flag, Star, Eye, ArrowLeft, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { notFound } from 'next/navigation';
import FlagActions from './FlagActions';
import FlagCard from '@/components/FlagCard';
import { Metadata } from 'next';
import Tag from '@/components/Tag';
import { Suspense } from 'react';
import FlagFieldsForm from '@/components/FlagFieldsForm';
import SourceBadge from '@/components/SourceBadge';

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
  const flag = await getFlagFromName(flagName);
  if (flag) {
    const pageUrl = `https://vexilo.org/flag/${encodeURIComponent(flag.name)}`;
    return {
      title: `${flag.name} - Vexilo`,
      description: flag.description,
      keywords: [
        flag.name,
        ...flag.tags,
        'Vexilo',
        'Flags',
        'World Flags',
        'Flag Collection',
        'Flag Search',
        'Flag Collection',
      ],
      openGraph: {
        title: `${flag.name} - Vexilo`,
        description: flag.description,
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
        description: flag.description,
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
  const flag = await getFlagFromName(flagName);
  const mode = (await searchParams).mode;

  if (!flag) {
    notFound();
  }

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
        <Badge variant='neutral' className='mb-2'>
          <Flag className='w-4 h-4 mr-1' />
          Flag #{flag.index}
        </Badge>
        <h1 className='text-4xl md:text-5xl font-bold tracking-tight'>
          {flag.name}
        </h1>
        {/* Tags before description */}
        {flag.tags && flag.tags.length > 0 && (
          <div className='flex flex-wrap gap-2 justify-center mb-2'>
            {flag.tags.map((tag: string) => (
              <Tag key={tag} text={tag} />
            ))}
          </div>
        )}
        {flag.description && (
          <p className='text-lg text-muted-foreground max-w-3xl mx-auto'>
            {flag.description}
          </p>
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
