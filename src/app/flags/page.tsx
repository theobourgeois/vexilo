import type { Metadata } from 'next';
import Link from 'next/link';
import { getCollectionFlags } from '@/actions/collections';
import FlagImage from '@/components/FlagImage';
import { COLLECTION_GROUPS, COLLECTIONS, collectionPath } from '@/lib/collections';
import { absoluteUrl } from '@/lib/seo';

// Collection contents are cached for a day; rendering on request keeps the build off the database.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Flag Collections: Flags by Colour, Pattern and Symbol | Vexilo',
  description:
    'Browse flags by colour, pattern and symbol: red and white flags, Nordic crosses, flags with an eagle, a crescent or a dragon, and more.',
  alternates: { canonical: absoluteUrl('/flags') },
};

export default async function CollectionsIndex() {
  const results = await Promise.all(COLLECTIONS.map((collection) => getCollectionFlags(collection.slug)));
  const collections = COLLECTIONS.map((collection, i) => ({ ...collection, top: results[i]?.flags[0], total: results[i]?.total ?? 0 }));

  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-16 md:px-8'>
      <div className='pb-[18px] pt-7'>
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Flag collections</h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>Flags grouped by colour, pattern, symbol and topic.</p>
      </div>
      {COLLECTION_GROUPS.map((group) => (
        <section key={group} className='mt-6'>
          <h2 className='mb-3 text-[17px] font-semibold tracking-[-0.02em]'>{group}</h2>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
            {collections
              .filter((collection) => collection.group === group)
              .map((collection) => (
                <Link
                  key={collection.slug}
                  href={collectionPath(collection.slug)}
                  className='vx-tile overflow-hidden transition-[box-shadow] duration-300 hover:shadow-tile-hover'
                >
                  <div className='flag-stage grid h-[110px] place-items-center bg-stage p-5'>
                    {collection.top && <FlagImage src={collection.top.image} alt={collection.top.name} maxHeight={64} area={100 * 64} />}
                  </div>
                  <div className='p-3.5'>
                    <span className='block truncate text-[14px] font-medium'>{collection.title}</span>
                    <span className='block tabular-nums text-[11.5px] text-muted-foreground'>
                      {collection.total.toLocaleString()} flags
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
