export interface DiffPart {
  kind: "same" | "added" | "removed";
  text: string;
}

/** Past this many words a side, the diff is shown whole: old out, new in. */
const MAX_WORDS = 600;

// Each word carries the space after it, so a rewritten phrase reads as one
// run struck and one run added, not word-space-word fragments.
const tokens = (text: string) => text.match(/\S+\s*|\s+/g) ?? [];

/**
 * A word-level diff of two strings, for showing a suggested rewrite in place:
 * what stays, what goes, what comes in. Whitespace travels with the words so
 * joining the parts back gives either text exactly.
 */
export const wordDiff = (before: string, after: string): DiffPart[] => {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length > MAX_WORDS || b.length > MAX_WORDS)
    return [
      ...(before ? [{ kind: "removed" as const, text: before }] : []),
      ...(after ? [{ kind: "added" as const, text: after }] : []),
    ];

  // Longest common subsequence, filled from the end so the walk below goes
  // forward through both texts.
  const lcs = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const parts: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string) => {
    const last = parts[parts.length - 1];
    if (last?.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push("removed", a[i++]);
    else push("added", b[j++]);
  }
  while (i < a.length) push("removed", a[i++]);
  while (j < b.length) push("added", b[j++]);
  return parts;
};
