/** Redis key holding the related flag IDs for a flag; delete it when its relations change. */
export const relatedFlagsCacheKey = (flagId: string) => `related-v2-${flagId}`;

/** Redis key holding the homepage's top contributors of the past week; delete it when a request is approved. */
export const TOP_CONTRIBUTORS_CACHE_KEY = 'top-contributors-week';
