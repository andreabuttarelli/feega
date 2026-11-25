import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { settingsStore } from './store';

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
