export type TidyRect = { id: string; left: number; top: number; width: number; height: number };
export type TidyMove = { id: string; dx: number; dy: number };

const bottom = (r: TidyRect) => r.top + r.height;
const right = (r: TidyRect) => r.left + r.width;

function rowsOf(rects: readonly TidyRect[]): TidyRect[][] {
  const rows: { end: number; items: TidyRect[] }[] = [];
  for (const r of [...rects].sort((a, b) => a.top - b.top)) {
    const row = rows[rows.length - 1];
    if (row && r.top < row.end) {
      row.items.push(r);
      row.end = Math.max(row.end, bottom(r));
      continue;
    }
    rows.push({ end: bottom(r), items: [r] });
  }
  return rows.map((row) => row.items.sort((a, b) => a.left - b.left));
}

function commonGap(gaps: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const g of gaps.map(Math.round)) {
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

const pairs = <T,>(list: readonly T[]): [T, T][] => list.slice(1).map((item, i) => [list[i], item]);

function line(items: readonly TidyRect[], start: (r: TidyRect) => number, end: (r: TidyRect) => number, size: (r: TidyRect) => number, move: (by: number) => Pick<TidyMove, 'dx' | 'dy'>): TidyMove[] {
  const gap = commonGap(pairs(items).map(([a, b]) => start(b) - end(a)));
  let at = start(items[0]);
  return items.map((r) => {
    const by = at - start(r);
    at += size(r) + gap;
    return { id: r.id, ...move(by) };
  });
}

function grid(rows: readonly TidyRect[][]): TidyMove[] {
  const columns = Math.max(...rows.map((r) => r.length));
  const column = (i: number) => rows.flatMap((row) => (row[i] ? [row[i]] : []));
  const widths = Array.from({ length: columns }, (_, i) => Math.max(...column(i).map((r) => r.width)));
  const heights = rows.map((row) => Math.max(...row.map((r) => r.height)));
  const gapX = commonGap(rows.flatMap((row) => pairs(row).map(([a, b]) => b.left - right(a))));
  const gapY = commonGap(Array.from({ length: columns }, (_, i) => pairs(column(i)).map(([a, b]) => b.top - bottom(a))).flat());
  const all = rows.flat();
  const left = Math.min(...all.map((r) => r.left));
  const top = Math.min(...all.map((r) => r.top));
  return rows.flatMap((row, y) =>
    row.map((r, x) => {
      const cellLeft = left + widths.slice(0, x).reduce((a, b) => a + b + gapX, 0);
      const cellTop = top + heights.slice(0, y).reduce((a, b) => a + b + gapY, 0);
      return { id: r.id, dx: cellLeft - r.left, dy: cellTop - r.top };
    })
  );
}

function arrange(rects: readonly TidyRect[]): TidyMove[] {
  const rows = rowsOf(rects);
  if (rows.length === 1) {
    return line(rows[0], (r) => r.left, right, (r) => r.width, (by) => ({ dx: by, dy: 0 }));
  }
  if (rows.every((row) => row.length === 1)) {
    return line(rows.flat(), (r) => r.top, bottom, (r) => r.height, (by) => ({ dx: 0, dy: by }));
  }
  return grid(rows);
}

export function tidyMoves(rects: readonly TidyRect[]): TidyMove[] {
  if (rects.length < 2) {
    return [];
  }
  return arrange(rects).filter((m) => m.dx !== 0 || m.dy !== 0);
}
