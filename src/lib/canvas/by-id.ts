export function byId<T extends { id: string }>(rows: readonly T[]): ReadonlyMap<string, T> {
  const index = new Map<string, T>();

  for (const row of rows) {
    if (!index.has(row.id)) {
      index.set(row.id, row);
    }
  }

  return index;
}
