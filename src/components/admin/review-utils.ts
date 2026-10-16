import type { ReviewQueueItem } from '@/actions/requests';
import { checkFileLikeName } from '@/lib/batch-flags';
import { diffLists } from '@/lib/text-diff';

export type ReviewFilter = 'all' | 'new' | 'edits' | 'attention';

export type ReviewGroup = {
  key: string;
  user: ReviewQueueItem['user'];
  items: ReviewQueueItem[];
  createdAt: Date;
};

const GROUP_WINDOW_MS = 60 * 60 * 1000;

/** Consecutive submissions from the same creator within an hour form one group. */
export function groupQueueItems(items: ReviewQueueItem[]): ReviewGroup[] {
  const groups: ReviewGroup[] = [];
  const openGroupByUser = new Map<string, ReviewGroup>();

  for (const item of items) {
    const createdAt = new Date(item.createdAt);
    const open = openGroupByUser.get(item.user.id);
    const last = open?.items[open.items.length - 1];
    if (
      open &&
      last &&
      createdAt.getTime() - new Date(last.createdAt).getTime() <= GROUP_WINDOW_MS
    ) {
      open.items.push(item);
      continue;
    }

    const group: ReviewGroup = {
      key: item.id,
      user: item.user,
      items: [item],
      createdAt,
    };
    groups.push(group);
    openGroupByUser.set(item.user.id, group);
  }

  return groups;
}

export function needsLook(item: ReviewQueueItem): string | null {
  if (item.duplicateOf) {
    return 'Already on Vexilo';
  }
  if (!item.isEdit && checkFileLikeName(item.flag.flagName)) {
    return 'Name looks like a file name';
  }
  if ((item.flag.sources ?? []).length === 0) {
    return 'No source';
  }
  return null;
}

export function matchesFilter(item: ReviewQueueItem, filter: ReviewFilter) {
  switch (filter) {
    case 'new':
      return !item.isEdit;
    case 'edits':
      return item.isEdit;
    case 'attention':
      return needsLook(item) !== null;
    default:
      return true;
  }
}

/** Short labels for what an edit request changes, e.g. ["image", "+2 tags"]. */
export function describeEditChanges(item: ReviewQueueItem): string[] {
  const before = item.oldFlag;
  const after = item.flag;
  if (!before) {
    return ['changes'];
  }

  const changes: string[] = [];
  if (before.flagImage !== after.flagImage) changes.push('image');
  if (before.flagName !== after.flagName) changes.push('name');

  const tags = diffLists(before.tags ?? [], after.tags ?? []);
  if (tags.added.length) changes.push(`+${tags.added.length} tag${tags.added.length === 1 ? '' : 's'}`);
  if (tags.removed.length) changes.push(`−${tags.removed.length} tag${tags.removed.length === 1 ? '' : 's'}`);

  if ((before.description ?? '') !== (after.description ?? '')) changes.push('description');

  const sources = diffLists(before.sources ?? [], after.sources ?? []);
  if (sources.added.length || sources.removed.length) changes.push('sources');

  const related = diffLists(
    (before.relatedFlags ?? []).map((flag) => flag.id),
    (after.relatedFlags ?? []).map((flag) => flag.id),
  );
  if (related.added.length || related.removed.length) changes.push('related flags');

  return changes.length > 0 ? changes : ['no changes'];
}

export function timeAgo(date: Date | string): string {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  const units: Array<[number, string]> = [
    [60 * 60 * 24 * 365, 'year'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, unit] of units) {
    const value = Math.floor(seconds / size);
    if (value >= 1) {
      return value === 1 && unit === 'day'
        ? 'yesterday'
        : `${value} ${unit}${value === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
