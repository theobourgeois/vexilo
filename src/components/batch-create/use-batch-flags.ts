'use client';

import {
  type ExistingFlagMatch,
  findExistingFlags,
  resolveWikimediaFlag,
} from '@/actions/batch-flags';
import {
  MAX_FLAG_IMAGE_BYTES,
  flagNameFromFileName,
  isDirectImageUrl,
  isValidSourceUrl,
  normalizeFlagNameForComparison,
  parseWikimediaFileTitle,
  checkFileLikeName,
} from '@/lib/batch-flags';
import { RelatedFlag } from '@/lib/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

const MAX_CONCURRENT_UPLOADS = 4;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
]);

type UploadState =
  | { state: 'uploading'; progress: number | null; label: string }
  | { state: 'done' }
  | { state: 'error'; message: string };

export type BatchFlagItem = {
  id: string;
  name: string;
  /** Original file name the name was derived from, if any. */
  origin: string | null;
  previewUrl: string;
  imageUrl: string | null;
  upload: UploadState;
  /** Sources specific to this flag; when empty the shared source is used. */
  ownSources: string[];
  tags: string[];
  description: string;
  relatedFlags: RelatedFlag[];
  userMessage: string;
  keepDuplicate: boolean;
  nameSuggestionDismissed: boolean;
};

export type BatchFlagIssue =
  | { kind: 'uploading' }
  | { kind: 'upload-error'; message: string }
  | { kind: 'missing-name' }
  | { kind: 'missing-source' }
  | { kind: 'duplicate'; name: string; status: ExistingFlagMatch['status'] }
  | { kind: 'batch-duplicate'; name: string }
  | { kind: 'file-like-name'; suggestion: string | null };

type ItemPatch = Partial<Omit<BatchFlagItem, 'id'>>;

function createItem(fields: Pick<BatchFlagItem, 'name' | 'origin' | 'previewUrl'> & ItemPatch): BatchFlagItem {
  return {
    id: crypto.randomUUID(),
    imageUrl: null,
    upload: { state: 'uploading', progress: 0, label: 'Uploading' },
    ownSources: [],
    tags: [],
    description: '',
    relatedFlags: [],
    userMessage: '',
    keepDuplicate: false,
    nameSuggestionDismissed: false,
    ...fields,
  };
}

function uploadFileWithProgress(
  file: File,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/flag-images');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      const body = xhr.response as { url?: string; message?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) {
        resolve(body.url);
      } else {
        reject(new Error(body?.message || 'Upload failed.'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort());

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

export function useBatchFlags() {
  const [items, setItems] = useState<BatchFlagItem[]>([]);
  const [sharedSource, setSharedSource] = useState('');
  const [existingMatches, setExistingMatches] = useState<
    Record<string, ExistingFlagMatch>
  >({});

  const queueRef = useRef<Array<{ id: string; run: (signal: AbortSignal) => Promise<void> }>>([]);
  const activeRef = useRef(new Map<string, AbortController>());
  const retryRef = useRef(new Map<string, () => void>());

  const updateItem = useCallback((id: string, patch: ItemPatch) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const pumpQueue = useCallback(() => {
    while (
      activeRef.current.size < MAX_CONCURRENT_UPLOADS &&
      queueRef.current.length > 0
    ) {
      const task = queueRef.current.shift()!;
      const controller = new AbortController();
      activeRef.current.set(task.id, controller);
      task
        .run(controller.signal)
        .finally(() => {
          activeRef.current.delete(task.id);
          pumpQueue();
        });
    }
  }, []);

  const enqueue = useCallback(
    (id: string, run: (signal: AbortSignal) => Promise<void>) => {
      retryRef.current.set(id, () => {
        queueRef.current.push({ id, run });
        pumpQueue();
      });
      queueRef.current.push({ id, run });
      pumpQueue();
    },
    [pumpQueue],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((file) => SUPPORTED_IMAGE_TYPES.has(file.type));
      const skipped = files.length - images.length;
      if (skipped > 0) {
        toast.error(
          `Skipped ${skipped} file${skipped === 1 ? '' : 's'} that ${skipped === 1 ? "isn't an image" : "aren't images"}.`,
        );
      }

      const newItems = images.map((file) => {
        const item = createItem({
          name: flagNameFromFileName(file.name),
          origin: file.name,
          previewUrl: URL.createObjectURL(file),
        });
        if (file.size > MAX_FLAG_IMAGE_BYTES) {
          item.upload = { state: 'error', message: 'Too large (4 MB max)' };
        }
        return { item, file };
      });

      setItems((current) => [...current, ...newItems.map(({ item }) => item)]);

      for (const { item, file } of newItems) {
        if (item.upload.state === 'error') {
          continue;
        }
        enqueue(item.id, async (signal) => {
          updateItem(item.id, {
            upload: { state: 'uploading', progress: 0, label: 'Uploading' },
          });
          try {
            const url = await uploadFileWithProgress(
              file,
              (progress) =>
                updateItem(item.id, {
                  upload: { state: 'uploading', progress, label: 'Uploading' },
                }),
              signal,
            );
            updateItem(item.id, { imageUrl: url, upload: { state: 'done' } });
          } catch (error) {
            if (signal.aborted) {
              return;
            }
            updateItem(item.id, {
              upload: {
                state: 'error',
                message: error instanceof Error ? error.message : 'Upload failed.',
              },
            });
          }
        });
      }

      return newItems.length;
    },
    [enqueue, updateItem],
  );

  const addUrls = useCallback(
    (urls: string[]) => {
      let added = 0;
      for (const url of urls) {
        const wikimediaTitle = parseWikimediaFileTitle(url);
        if (wikimediaTitle) {
          const fileName = wikimediaTitle.replace(/^File:/, '');
          const item = createItem({
            name: flagNameFromFileName(fileName),
            origin: fileName,
            previewUrl: '',
            upload: { state: 'uploading', progress: null, label: 'Fetching from Wikimedia' },
          });
          setItems((current) => [...current, item]);
          added += 1;

          enqueue(item.id, async (signal) => {
            updateItem(item.id, {
              upload: { state: 'uploading', progress: null, label: 'Fetching from Wikimedia' },
            });
            const result = await resolveWikimediaFlag(url).catch(() => null);
            if (signal.aborted) {
              return;
            }
            if (!result?.success) {
              updateItem(item.id, {
                upload: {
                  state: 'error',
                  message: result?.message ?? 'Could not fetch from Wikimedia.',
                },
              });
              return;
            }
            setItems((current) =>
              current.map((existing) =>
                existing.id === item.id
                  ? {
                      ...existing,
                      // Keep any name the user already typed while it was loading.
                      name:
                        existing.name === item.name ? result.name : existing.name,
                      origin: result.fileName,
                      previewUrl: result.imageUrl,
                      imageUrl: result.imageUrl,
                      ownSources:
                        existing.ownSources.length > 0
                          ? existing.ownSources
                          : [result.source],
                      upload: { state: 'done' },
                    }
                  : existing,
              ),
            );
          });
          continue;
        }

        if (isDirectImageUrl(url)) {
          const fileName = new URL(url).pathname.split('/').pop() ?? url;
          setItems((current) => [
            ...current,
            createItem({
              name: flagNameFromFileName(fileName),
              origin: fileName,
              previewUrl: url,
              imageUrl: url,
              upload: { state: 'done' },
            }),
          ]);
          added += 1;
        }
      }
      return added;
    },
    [enqueue, updateItem],
  );

  const removeItem = useCallback((id: string) => {
    activeRef.current.get(id)?.abort();
    queueRef.current = queueRef.current.filter((task) => task.id !== id);
    retryRef.current.delete(id);
    setItems((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const retryItem = useCallback((id: string) => {
    retryRef.current.get(id)?.();
  }, []);

  const canRetry = useCallback((id: string) => retryRef.current.has(id), []);

  const reset = useCallback(() => {
    for (const controller of activeRef.current.values()) {
      controller.abort();
    }
    queueRef.current = [];
    retryRef.current.clear();
    setItems((current) => {
      for (const item of current) {
        if (item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      return [];
    });
    setExistingMatches({});
  }, []);

  const sharedSourceValid = isValidSourceUrl(sharedSource);
  const sourcesFor = useCallback(
    (item: BatchFlagItem) =>
      item.ownSources.length > 0
        ? item.ownSources
        : sharedSourceValid
          ? [sharedSource.trim()]
          : [],
    [sharedSource, sharedSourceValid],
  );

  // Check names/sources against existing flags, debounced while typing.
  const duplicateCheckKey = JSON.stringify(
    items.map((item) => [item.id, item.name.trim(), item.ownSources]),
  );
  useEffect(() => {
    const candidates = items
      .filter((item) => item.name.trim())
      .map((item) => ({ key: item.id, name: item.name, sources: item.ownSources }));
    if (candidates.length === 0) {
      setExistingMatches({});
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      findExistingFlags(candidates)
        .then((matches) => {
          if (!cancelled) {
            setExistingMatches(
              Object.fromEntries(matches.map((match) => [match.key, match])),
            );
          }
        })
        .catch(() => {});
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateCheckKey]);

  const issuesById = useMemo(() => {
    const seenNames = new Map<string, string>();
    const result: Record<string, BatchFlagIssue[]> = {};

    for (const item of items) {
      const issues: BatchFlagIssue[] = [];
      const name = item.name.trim();

      if (item.upload.state === 'uploading') {
        issues.push({ kind: 'uploading' });
      } else if (item.upload.state === 'error') {
        issues.push({ kind: 'upload-error', message: item.upload.message });
      }

      if (!name) {
        issues.push({ kind: 'missing-name' });
      }

      if (sourcesFor(item).length === 0) {
        issues.push({ kind: 'missing-source' });
      }

      const normalized = normalizeFlagNameForComparison(name);
      const existing = existingMatches[item.id];
      if (!item.keepDuplicate && existing) {
        issues.push({ kind: 'duplicate', name: existing.name, status: existing.status });
      } else if (!item.keepDuplicate && name && seenNames.has(normalized)) {
        issues.push({ kind: 'batch-duplicate', name: seenNames.get(normalized)! });
      }
      if (name && !seenNames.has(normalized)) {
        seenNames.set(normalized, name);
      }

      const fileLikeName = item.nameSuggestionDismissed
        ? null
        : checkFileLikeName(name);
      if (fileLikeName) {
        issues.push({ kind: 'file-like-name', suggestion: fileLikeName.suggestion });
      }

      result[item.id] = issues;
    }

    return result;
  }, [items, existingMatches, sourcesFor]);

  useEffect(() => {
    const active = activeRef.current;
    return () => {
      for (const controller of active.values()) {
        controller.abort();
      }
    };
  }, []);

  return {
    items,
    sharedSource,
    setSharedSource,
    sharedSourceValid,
    sourcesFor,
    issuesById,
    addFiles,
    addUrls,
    updateItem,
    removeItem,
    retryItem,
    canRetry,
    reset,
  };
}

export function isBlockingIssue(issue: BatchFlagIssue): boolean {
  return issue.kind !== 'file-like-name';
}
