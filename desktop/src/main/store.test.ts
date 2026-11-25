import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inviteWanted, settingsStore } from './store';

const fresh = () => mkdtempSync(join(tmpdir(), 'feega-store-'));

describe('settings store', () => {
  it('keeps Feega Cloud off by default', () => {
    expect(settingsStore(fresh()).get().preferences.cloud).toBe(false);
  });

  it('remembers the Cloud preference', () => {
    const dir = fresh();
    settingsStore(dir).prefer({ cloud: true });

    expect(settingsStore(dir).get().preferences.cloud).toBe(true);
  });
});

describe('account invite', () => {
  it('waits for a first created project', () => {
    expect(inviteWanted(settingsStore(fresh()).get(), null)).toBe(false);
  });

  it('shows after the first project until dismissed, and remembers it', () => {
    const dir = fresh();
    const store = settingsStore(dir);
    store.created();

    expect(inviteWanted(store.get(), null)).toBe(true);

    store.dismissInvite();

    expect(inviteWanted(settingsStore(dir).get(), null)).toBe(false);
  });

  it('never shows to a signed in user', () => {
    const store = settingsStore(fresh());
    store.created();

    expect(inviteWanted(store.get(), 'a@b.c')).toBe(false);
  });
});

describe('onboarding', () => {
  it('is pending on a fresh install', () => {
    expect(settingsStore(fresh()).get().onboarded).toBe(false);
  });

  it('is remembered once finished', () => {
    const dir = fresh();
    settingsStore(dir).finishOnboarding();

    expect(settingsStore(dir).get().onboarded).toBe(true);
  });

  it('comes back when replayed', () => {
    const dir = fresh();
    const store = settingsStore(dir);
    store.finishOnboarding();
    store.replayOnboarding();

    expect(settingsStore(dir).get().onboarded).toBe(false);
  });

  it('does not greet an install that already opened projects', () => {
    const dir = fresh();
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ recents: [{ dir: '/a', at: 1 }] }));

    expect(settingsStore(dir).get().onboarded).toBe(true);
  });
});
