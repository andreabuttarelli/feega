export enum DiffLine {
  Same = 'same',
  Removed = 'removed',
  Added = 'added'
}

export type DiffRow = { kind: DiffLine; text: string };

const rows = (kind: DiffLine, lines: string[]): DiffRow[] => lines.map((text) => ({ kind, text }));

export function lineDiff(before: string | null, after: string): DiffRow[] {
  const next = after.split('\n');
  if (before === null) {
    return rows(DiffLine.Added, next);
  }
  const prev = before.split('\n');
  let head = 0;
  while (head < prev.length && head < next.length && prev[head] === next[head]) {
    head++;
  }
  let tail = 0;
  while (tail < prev.length - head && tail < next.length - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) {
    tail++;
  }
  return [...rows(DiffLine.Same, prev.slice(0, head)), ...rows(DiffLine.Removed, prev.slice(head, prev.length - tail)), ...rows(DiffLine.Added, next.slice(head, next.length - tail)), ...rows(DiffLine.Same, prev.slice(prev.length - tail))];
}
