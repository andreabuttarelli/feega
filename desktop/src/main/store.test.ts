import { mkdtempSync } from 'node:fs';
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
