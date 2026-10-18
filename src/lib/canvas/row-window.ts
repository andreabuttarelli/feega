export type RowView = { scrollTop: number; height: number; count: number; rowPx: number; overscan: number };
export type RowWindow = { start: number; end: number };

export function rowWindow({ scrollTop, height, count, rowPx, overscan }: RowView): RowWindow {
  const top = Math.max(0, scrollTop);
  const first = Math.min(count, Math.floor(top / rowPx));
  const last = Math.ceil((top + height) / rowPx);
  return { start: Math.max(0, first - overscan), end: Math.min(count, last + overscan) };
}
