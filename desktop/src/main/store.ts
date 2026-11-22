import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Preferences } from './types';

const MAX_RECENTS = 12;

export type Recent = { dir: string; at: number };

export type Settings = { recents: Recent[]; skipped: boolean; openDirs: string[]; preferences: Preferences };

export const AUTO_PORT = 0;

const DEFAULT_PREFERENCES: Preferences = { editorPort: AUTO_PORT, reopenOnLaunch: false, telemetry: true, automaticUpdates: true };

const EMPTY: Settings = { recents: [], skipped: false, openDirs: [], preferences: DEFAULT_PREFERENCES };

const asRecent = (entry: string | Recent): Recent => (typeof entry === 'string' ? { dir: entry, at: 0 } : entry);

export function settingsStore(userData: string) {
  const path = join(userData, 'settings.json');
  let current: Settings = EMPTY;

  try {
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    current = { ...EMPTY, ...stored, recents: (stored.recents ?? []).map(asRecent), preferences: { ...DEFAULT_PREFERENCES, ...stored.preferences } };
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
    visit: (dir: string) => save({ ...current, recents: [{ dir, at: Date.now() }, ...current.recents.filter((r) => r.dir !== dir)].slice(0, MAX_RECENTS) }),
    skip: () => save({ ...current, skipped: true }),
    unskip: () => save({ ...current, skipped: false }),
    remember: (openDirs: string[]) => save({ ...current, openDirs }),
    prefer: (change: Partial<Preferences>) => save({ ...current, preferences: { ...current.preferences, ...change } })
  };
}
