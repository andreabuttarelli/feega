export type OverlaySplice<T> = { head: number; tail: number; items: T[] };

export function overlaySplice<T>(last: readonly T[] | null, next: readonly T[]): OverlaySplice<T> | null {
  if (!last) {
    return null;
  }

  const room = Math.min(last.length, next.length);
  let head = 0;
  while (head < room && last[head] === next[head]) {
    head++;
  }

  let tail = 0;
  while (tail < room - head && last[last.length - 1 - tail] === next[next.length - 1 - tail]) {
    tail++;
  }

  return { head, tail, items: next.slice(head, next.length - tail) };
}
