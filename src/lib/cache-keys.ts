/** Redis key holding the related flag IDs for a flag; delete it when its relations change. */
export const relatedFlagsCacheKey = (flagId: string) => `related-v2-${flagId}`;
