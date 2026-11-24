import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ToHost, type HostMessage, type Source } from '../messages';
import { SettingKey } from '../settings';
import type { BridgeState } from './local-bridge/server';
import type { Platform } from './platform';
import { inspectSession } from './session';

const at: Source = { file: 'src/home.ts', line: 3, col: 1 };

async function setup() {
  let handle: (m: HostMessage) => unknown = () => undefined;
  const published: { projectRoot: string; state: BridgeState }[] = [];
  const log: string[] = [];
  const platform = {
    send: () => undefined,
    stored: () => undefined,
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({ [SettingKey.SyncSelection]: false }),
    localBridge: async (projectRoot: string, state: BridgeState) => (published.push({ projectRoot, state }), { touch: () => void log.push('touch'), stop: async () => void log.push('stop') })
  } as unknown as Platform;
  const root = mkdtempSync(join(tmpdir(), 'feega-bridge-'));
  const session = inspectSession(platform, root);
  await new Promise((resolve) => setImmediate(resolve));
  return { root, log, session, state: () => published[0].state, published, send: handle };
}

describe('local bridge of the session', () => {
  it('publishes the workspace it edits', async () => {
    const { published, root } = await setup();

    expect(published.map((p) => p.projectRoot)).toEqual([root]);
  });

  it('serves the context the panel sent', async () => {
    const { state, send } = await setup();
    expect(state().selection()).toBeNull();
    send({ kind: ToHost.Context, text: 'Feega selection' });

    expect(state().selection()).toBe('Feega selection');
  });

  it('marks the editor active on a selection', async () => {
    const { log, send } = await setup();
    send({ kind: ToHost.Selected, at });
    await new Promise((resolve) => setImmediate(resolve));

    expect(log).toEqual(['touch']);
  });

  it('serves no changes before any edit', async () => {
    const { state } = await setup();

    expect(state().changes()).toEqual([]);
  });

  it('unregisters when the session stops', async () => {
    const { log, session } = await setup();
    await session.stop();

    expect(log).toContain('stop');
  });
});
