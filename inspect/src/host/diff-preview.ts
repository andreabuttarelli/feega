import type { FileChange } from '@feega/live-edit/files';

export type DiffFile = { path: string; line: number; removed: string[]; added: string[]; more?: number };

const MAX_LINES = 8;

function diffFile({ path, before, after }: FileChange): DiffFile | null {
  const was = before.split('\n');
  const now = after.split('\n');
  let head = 0;
  while (head < was.length && head < now.length && was[head] === now[head]) {
    head++;
  }

  let tail = 0;
  while (tail < was.length - head && tail < now.length - head && was[was.length - 1 - tail] === now[now.length - 1 - tail]) {
    tail++;
  }

  const removed = was.slice(head, was.length - tail);
  const added = now.slice(head, now.length - tail);
  if (!removed.length && !added.length) {
    return null;
  }

  const hidden = Math.max(removed.length, added.length) - MAX_LINES;
  return { path, line: head + 1, removed: removed.slice(0, MAX_LINES), added: added.slice(0, MAX_LINES), ...(hidden > 0 ? { more: hidden } : {}) };
}

export const diffOf = (changes: FileChange[]): DiffFile[] => changes.map(diffFile).filter((d): d is DiffFile => d !== null);
