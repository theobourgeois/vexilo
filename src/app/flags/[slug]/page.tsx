import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollectionFlags, getLiveFavorites } from '@/actions/collections';
import FlagCard from '@/components/FlagCard';
import { ChevronRight } from '@/components/icons';
import { COLLECTIONS, collectionPath, getCollection } from '@/lib/collections';
import { absoluteUrl, flagHeadline, flagPath, jsonLd } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = getCollection((await params).slug);
  if (!collection) return { title: 'Collection not found - Vexilo' };
  const url = absoluteUrl(collectionPath(collection.slug));
  return {
    title: `${collection.title} | Vexilo`,
    description: collection.description,
    alternates: { canonical: url },
    openGraph: { title: collection.title, description: collection.description, url, siteName: 'Vexilo' },
  };
}

export default async function CollectionPage({ params }: Props) {
  const collection = getCollection((await params).slug);
  if (!collection) notFound();
  const result = await getCollectionFlags(collection.slug);
  if (!result) notFound();
  const live = await getLiveFavorites(result.flags.map((flag) => flag.id));
  const url = absoluteUrl(collectionPath(collection.slug));
  const others = COLLECTIONS.filter((other) => other.slug !== collection.slug);
  // Same kind first, so a colour collection leads to the other colours.
  const related = [...others.filter((other) => other.group === collection.group), ...others.filter((other) => other.group !== collection.group)];

  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-16 md:px-8'>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={jsonLd({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CollectionPage',
              '@id': url,
              url,
              name: collection.title,
              description: collection.description,
              isPartOf: { '@type': 'WebSite', name: 'Vexilo', url: absoluteUrl('/') },
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: result.total,
                itemListElement: result.flags.slice(0, 30).map((flag, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  url: absoluteUrl(flagPath(flag.name)),
                  name: flagHeadline(flag.name),
                })),
              },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Vexilo', item: absoluteUrl('/') },
                { '@type': 'ListItem', position: 2, name: 'Collections', item: absoluteUrl('/flags') },
                { '@type': 'ListItem', position: 3, name: collection.title, item: url },
              ],
            },
          ],
        })}
      />
      <nav className='flex items-center gap-2 pb-4 pt-[22px] text-[13px] text-muted-foreground'>
        <Link href='/' className='hover:text-foreground'>
          Browse
        </Link>
        <ChevronRight className='size-3' />
        <Link href='/flags' className='hover:text-foreground'>
          Collections
        </Link>
        <ChevronRight className='size-3' />
        <span className='truncate font-medium text-foreground'>{collection.title}</span>
      </nav>

      <div className='pb-6'>
        <h1 className='flex items-baseline gap-2.5 text-[28px] font-semibold tracking-[-0.03em]'>
          {collection.title}
          <span className='tabular-nums text-sm font-normal tracking-normal text-muted-foreground'>
            {result.total.toLocaleString()}
          </span>
        </h1>
        <p className='mt-1.5 max-w-[680px] text-[14px] text-subtle'>{collection.description}</p>
      </div>

      {result.flags.length > 0 ? (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {result.flags.map((flag) => (
            <FlagCard
              key={flag.id}
              id={flag.id}
              flagName={flag.name}
              flagImage={flag.image}
              sources={flag.sources}
              favorites={live?.get(flag.id)?.favorites ?? flag.favorites}
              isFavorite={live?.get(flag.id)?.isFavorite ?? false}
              link={flag.link}
              index={flag.index}
              tags={flag.tags}
              description={flag.description}
            />
          ))}
        </div>
      ) : (
        <div className='vx-tile px-6 py-14 text-center text-[13px] text-muted-foreground'>No flags here yet.</div>
      )}
      {result.total > result.flags.length && (
        <p className='mt-6 text-center text-[13px] text-muted-foreground'>
          Showing the {result.flags.length} most popular of {result.total.toLocaleString()}.
        </p>
      )}

      <section className='mt-14'>
        <h2 className='mb-3 text-[17px] font-semibold tracking-[-0.02em]'>More collections</h2>
        <div className='flex flex-wrap gap-1.5'>
          {related.map((other) => (
            <Link
              key={other.slug}
              href={collectionPath(other.slug)}
              className='vx-key rounded-full px-3 py-1.5 text-[13px] text-subtle transition-colors hover:text-foreground'
            >
              {other.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
