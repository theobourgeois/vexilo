'use client';

import {
  type ReviewQueueItem,
  approveFlagRequests,
  declineFlagRequests,
  getReviewQueue,
} from '@/actions/requests';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

const QUEUE_KEY = ['reviewQueue'];

export function useReviewQueue() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () => getReviewQueue(),
  });

  const removeFromCache = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      queryClient.setQueryData<Awaited<ReturnType<typeof getReviewQueue>>>(
        QUEUE_KEY,
        (current) =>
          current
            ? {
                total: Math.max(current.total - ids.length, 0),
                items: current.items.filter((item) => !idSet.has(item.id)),
              }
            : current,
      );
    },
    [queryClient],
  );

  const refreshRelated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['adminCounts'] });
    queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    queryClient.invalidateQueries({ queryKey: ['adminFlags'] });
  }, [queryClient]);

  /** Optimistically removes the requests, then approves them in order. */
  const approve = useCallback(
    async (ids: string[], options?: { quiet?: boolean }) => {
      if (ids.length === 0) return;
      removeFromCache(ids);
      const result = await approveFlagRequests(ids).catch(() => null);
      refreshRelated();
      if (!result) {
        toast.error('Approving failed. Refreshing the queue.');
        queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
        return;
      }
      if (result.failed.length > 0) {
        toast.error(
          `${result.failed.length} couldn't be approved: ${result.failed[0].message}`,
        );
        queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      }
      if (!options?.quiet && result.approved.length > 0) {
        toast.success(
          `Approved ${result.approved.length} request${result.approved.length === 1 ? '' : 's'}.`,
        );
      }
    },
    [queryClient, refreshRelated, removeFromCache],
  );

  const decline = useCallback(
    async (ids: string[], options?: { quiet?: boolean }) => {
      if (ids.length === 0) return;
      removeFromCache(ids);
      const result = await declineFlagRequests(ids).catch(() => null);
      refreshRelated();
      if (!result) {
        toast.error('Declining failed. Refreshing the queue.');
        queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
        return;
      }
      if (!options?.quiet) {
        toast.success(
          `Declined ${result.declined.length} request${result.declined.length === 1 ? '' : 's'}.`,
        );
      }
    },
    [queryClient, refreshRelated, removeFromCache],
  );

  const patchItem = useCallback(
    (id: string, flagPatch: Partial<ReviewQueueItem['flag']>) => {
      queryClient.setQueryData<Awaited<ReturnType<typeof getReviewQueue>>>(
        QUEUE_KEY,
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === id
                    ? { ...item, flag: { ...item.flag, ...flagPatch } }
                    : item,
                ),
              }
            : current,
      );
    },
    [queryClient],
  );

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    approve,
    decline,
    patchItem,
    refetch: query.refetch,
  };
}
