export const SEARCH_THRESHOLD = 6;

export function needsSearch(count: number): boolean {
  return count > SEARCH_THRESHOLD;
}

export function recentFirst<T extends { updatedAt: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function matching<T extends { name: string }>(rows: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...rows];
  }
  return rows.filter((row) => row.name.toLowerCase().includes(needle));
}
