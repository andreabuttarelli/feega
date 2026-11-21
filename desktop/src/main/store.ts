import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MAX_RECENTS = 12;

export type Settings = { recents: string[]; skipped: boolean };

const EMPTY: Settings = { recents: [], skipped: false };

export function settingsStore(userData: string) {
  const path = join(userData, 'settings.json');
  let current: Settings = EMPTY;

  try {
    current = { ...EMPTY, ...JSON.parse(readFileSync(path, 'utf8')) };
  } catch {
    current = EMPTY;
  }

  const save = (next: Settings) => {
    current = next;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(current, null, 2));
  };

  return {
    get: () => current,
    visit: (dir: string) => save({ ...current, recents: [dir, ...current.recents.filter((d) => d !== dir)].slice(0, MAX_RECENTS) }),
    skip: () => save({ ...current, skipped: true }),
    unskip: () => save({ ...current, skipped: false })
  };
}
