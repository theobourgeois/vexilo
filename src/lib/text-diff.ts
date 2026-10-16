export type DiffPart = { type: 'same' | 'added' | 'removed'; text: string };

const MAX_DIFF_TOKENS = 1500;

function pushPart(parts: DiffPart[], type: DiffPart['type'], text: string) {
  const last = parts[parts.length - 1];
  if (last && last.type === type) {
    last.text += text;
  } else {
    parts.push({ type, text });
  }
}

/** Word-level diff (LCS) used to show what an edit changes in a text field. */
export function diffWords(before: string, after: string): DiffPart[] {
  if (before === after) {
    return before ? [{ type: 'same', text: before }] : [];
  }

  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);

  if (a.length > MAX_DIFF_TOKENS || b.length > MAX_DIFF_TOKENS) {
    return [
      ...(before ? [{ type: 'removed' as const, text: before }] : []),
      ...(after ? [{ type: 'added' as const, text: after }] : []),
    ];
  }

  // lengths[i][j] = LCS length of a[i:] and b[j:]
  const lengths = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pushPart(parts, 'same', a[i]);
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      pushPart(parts, 'removed', a[i++]);
    } else {
      pushPart(parts, 'added', b[j++]);
    }
  }
  while (i < a.length) pushPart(parts, 'removed', a[i++]);
  while (j < b.length) pushPart(parts, 'added', b[j++]);

  return parts;
}

export function diffLists<T>(before: T[], after: T[]) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    kept: after.filter((item) => beforeSet.has(item)),
    added: after.filter((item) => !beforeSet.has(item)),
    removed: before.filter((item) => !afterSet.has(item)),
  };
}
