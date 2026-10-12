export enum Dismiss {
  Detail = 'detail',
  Library = 'library'
}

export const dismissFrom = (openId: string | null): Dismiss => (openId ? Dismiss.Detail : Dismiss.Library);

export type Grid = { count: number; columns: number };

const MOVES: Record<string, (at: number, grid: Grid) => number> = {
  ArrowRight: (at) => at + 1,
  ArrowLeft: (at) => at - 1,
  ArrowDown: (at, { columns }) => at + columns,
  ArrowUp: (at, { columns }) => (at < columns ? at : at - columns),
  Home: () => 0,
  End: (_at, { count }) => count - 1
};

export function gridStep(at: number, key: string, grid: Grid): number | null {
  const move = MOVES[key];
  if (!move) {
    return null;
  }
  return Math.max(0, Math.min(grid.count - 1, move(at, grid)));
}
