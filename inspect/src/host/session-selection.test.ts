import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToHost, type HostMessage, type Source } from '../messages';
import { SettingKey } from '../settings';
import type { Platform } from './platform';
import { inspectSession } from './session';

const SETTLE_MS = 500;
const at: Source = { file: 'src/home.ts', line: 3, col: 1 };

function setup(sync: boolean) {
  const revealed: { root: string; at: Source }[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const platform = {
    send: () => undefined,
    stored: () => undefined,
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({ [SettingKey.SyncSelection]: sync }),
    revealSource: async (root: string, source: Source) => void revealed.push({ root, at: source })
  } as unknown as Platform;
  const root = mkdtempSync(join(tmpdir(), 'feega-sel-'));
  inspectSession(platform, root);
  return { revealed, root, select: (source: Source | null) => handle({ kind: ToHost.Selected, at: source }) };
}

describe('selezione nella sessione', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('un elemento selezionato in Feega viene rivelato nell\'editor', () => {
    const { revealed, root, select } = setup(true);
    select(at);
    vi.advanceTimersByTime(SETTLE_MS);

    expect(revealed).toEqual([{ root, at }]);
  });

  it('con syncSelection spento l\'editor non si muove', () => {
    const { revealed, select } = setup(false);
    select(at);
    vi.advanceTimersByTime(SETTLE_MS);

    expect(revealed).toEqual([]);
  });
});
