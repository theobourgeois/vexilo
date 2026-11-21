import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@shared/seo';

/**
 * Keeps crawlers on the pages worth indexing. The flag maker (every `/create?remix=…` is a
 * separate, dynamically rendered URL), the API and the signed-in pages are left out.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/create', '/api/', '/admin', '/settings', '/post-flag'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
