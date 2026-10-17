import { type DiffPart, diffLists, diffWords } from '@/lib/text-diff';

type FlagSnapshot = {
  flagName?: string;
  flagImage?: string;
  tags?: string[];
  sources?: string[];
  description?: string;
} | null;

export type EditChange =
  | { kind: 'name'; before: string; after: string }
  | { kind: 'image'; before: string; after: string }
  | { kind: 'tags'; added: string[]; removed: string[] }
  | { kind: 'sources'; added: string[]; removed: string[] }
  | { kind: 'description'; parts: DiffPart[] };

const CONTEXT_CHARS = 40;

/** Trims long unchanged runs in a text diff so only the edited bits and a little context remain. */
function trimDiff(parts: DiffPart[]): DiffPart[] {
  return parts.map((part, index) => {
    if (part.type !== 'same' || part.text.length <= CONTEXT_CHARS * 2) return part;
    const isFirst = index === 0;
    const isLast = index === parts.length - 1;
    if (isFirst) return { ...part, text: `…${part.text.slice(-CONTEXT_CHARS)}` };
    if (isLast) return { ...part, text: `${part.text.slice(0, CONTEXT_CHARS)}…` };
    return { ...part, text: `${part.text.slice(0, CONTEXT_CHARS)} … ${part.text.slice(-CONTEXT_CHARS)}` };
  });
}

/** What an approved edit changed, for the public edit history. */
export function describeEdit(before: FlagSnapshot, after: FlagSnapshot): EditChange[] {
  if (!before || !after) return [];
  const changes: EditChange[] = [];
  if (before.flagName && after.flagName && before.flagName !== after.flagName) {
    changes.push({ kind: 'name', before: before.flagName, after: after.flagName });
  }
  if (before.flagImage && after.flagImage && before.flagImage !== after.flagImage) {
    changes.push({ kind: 'image', before: before.flagImage, after: after.flagImage });
  }
  const tags = diffLists(before.tags ?? [], after.tags ?? []);
  if (tags.added.length || tags.removed.length) changes.push({ kind: 'tags', added: tags.added, removed: tags.removed });
  const sources = diffLists(before.sources ?? [], after.sources ?? []);
  if (sources.added.length || sources.removed.length) {
    changes.push({ kind: 'sources', added: sources.added, removed: sources.removed });
  }
  if ((before.description ?? '') !== (after.description ?? '')) {
    changes.push({ kind: 'description', parts: trimDiff(diffWords(before.description ?? '', after.description ?? '')) });
  }
  return changes;
}

/** Short verb phrase for an edit, e.g. "renamed the flag" or "made 3 changes". */
export function summarizeEdit(changes: EditChange[]): string {
  if (changes.length === 0) return 'edited the flag';
  if (changes.length > 1) return `made ${changes.length} changes`;
  const [change] = changes;
  switch (change.kind) {
    case 'name':
      return 'renamed the flag';
    case 'image':
      return 'replaced the image';
    case 'tags':
      return change.removed.length === 0 ? 'added tags' : change.added.length === 0 ? 'removed tags' : 'edited tags';
    case 'sources':
      return change.removed.length === 0 ? `added ${change.added.length === 1 ? 'a source' : 'sources'}` : 'edited sources';
    case 'description':
      return 'edited the description';
  }
}
