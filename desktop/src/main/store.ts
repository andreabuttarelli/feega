import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Preferences } from './types';

const MAX_RECENTS = 12;

export type Recent = { dir: string; at: number };

export type Settings = { recents: Recent[]; skipped: boolean; openDirs: string[]; preferences: Preferences; createdProject: boolean; inviteDismissed: boolean; onboarded: boolean };

export const AUTO_PORT = 0;

const DEFAULT_PREFERENCES: Preferences = { editorPort: AUTO_PORT, reopenOnLaunch: false, automaticUpdates: true, cloud: false };

const EMPTY: Settings = { recents: [], skipped: false, openDirs: [], preferences: DEFAULT_PREFERENCES, createdProject: false, inviteDismissed: false, onboarded: false };

export const inviteWanted = (settings: Settings, email: string | null): boolean => settings.createdProject && !settings.inviteDismissed && email === null;

const asRecent = (entry: string | Recent): Recent => (typeof entry === 'string' ? { dir: entry, at: 0 } : entry);

export function settingsStore(userData: string) {
  const path = join(userData, 'settings.json');
  let current: Settings = EMPTY;
  let telemetryOff = false;

  try {
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    const recents = (stored.recents ?? []).map(asRecent);
    telemetryOff = stored.preferences?.telemetry === false;
    current = { ...EMPTY, ...stored, onboarded: stored.onboarded ?? recents.length > 0, recents, preferences: { ...DEFAULT_PREFERENCES, ...stored.preferences } };
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
    legacyTelemetryOff: () => telemetryOff,
    visit: (dir: string) => save({ ...current, recents: [{ dir, at: Date.now() }, ...current.recents.filter((r) => r.dir !== dir)].slice(0, MAX_RECENTS) }),
    skip: () => save({ ...current, skipped: true }),
    unskip: () => save({ ...current, skipped: false }),
    created: () => save({ ...current, createdProject: true }),
    finishOnboarding: () => save({ ...current, onboarded: true }),
    replayOnboarding: () => save({ ...current, onboarded: false }),
    dismissInvite: () => save({ ...current, inviteDismissed: true }),
    remember: (openDirs: string[]) => save({ ...current, openDirs }),
    prefer: (change: Partial<Preferences>) => save({ ...current, preferences: { ...current.preferences, ...change } })
  };
}
