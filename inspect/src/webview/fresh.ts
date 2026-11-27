export const FRESH_MS = 2500;

export const addedKeys = (before: string[] | null, now: string[]): string[] => (!before?.length ? [] : now.filter((key) => !before.includes(key)));
