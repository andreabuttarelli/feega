import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';
import { Device, Editor, type UsageEvent } from './usage';

function setup(enabled = true) {
  const sent: UsageEvent[] = [];
  const dir = mkdtempSync(join(tmpdir(), 'feega-session-usage-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } }));
  writeFileSync(join(dir, 'src/Page.svelte'), '<h1 class="text-2xl">Hello</h1>\n');
  const platform = {
    version: '1',
    launcher: '',
    send: () => undefined,
    receive: () => undefined,
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    usage: {
      identity: () => ({ installId: '3f1c9a52-5b0e-4c1d-9a54-0d2f6f1e7a10', version: '1', editor: Editor.Npx, os: 'linux', arch: 'x64', device: Device.Cli }),
      enabled: () => enabled,
      send: async (events: UsageEvent[]) => void sent.push(...events),
      every: () => () => undefined
    }
  } as unknown as Platform;
  return { session: inspectSession(platform, dir), sent };
}

describe('usage in the session', () => {
  it('counts a change written to source and reports it when the session stops', async () => {
    const { session, sent } = setup();

    await session.edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Color, value: '#ff0000' });
    await session.edit({ at: 'src/Missing.svelte:1:1', prop: LiveProp.Color, value: '#00ff00' });
    await session.stop();

    expect(sent.map((e) => e.event)).toEqual(['opened', 'session_start', 'edit', 'session_end']);
    expect(sent[3].edit_count).toBe(1);
  });

  it('reports nothing when telemetry is off', async () => {
    const { session, sent } = setup(false);

    await session.edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Color, value: '#ff0000' });
    await session.stop();

    expect(sent).toEqual([]);
  });
});
