const NOT_FOUND = -1;

export const maskOf = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

export function nextTile(key: string, from: number, count: number, columns: number): number {
  const last = count - 1;
  const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
  if (!(key in step)) {
    return from;
  }
  const to = from + step[key];
  if (to < 0) {
    return key === 'ArrowUp' ? NOT_FOUND : 0;
  }
  return Math.min(to, last);
}
