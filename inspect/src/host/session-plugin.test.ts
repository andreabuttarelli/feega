import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OpKind } from '@feega/plugin-api/protocol';
import { PluginCall, ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'feega-plugin-'));
  writeFileSync(join(root, 'package.json'), '{\n  "name": "a"\n}\n');
  const sent: ViewMessage[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => sent.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore()
  } as unknown as Platform;
  inspectSession(platform, root);
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 200 && !check(); i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
  };
  return { root, sent, send: (m: HostMessage) => handle(m), until };
}

describe('plugin calls in the session', () => {
  it('writes a proposal through the engine and answers the plugin', async () => {
    const t = setup();
    t.send({ kind: ToHost.Plugin, id: 7, ask: { call: PluginCall.Propose, proposal: { label: '3D object', ops: [{ kind: OpKind.Dependency, name: 'three', version: '^0.180.0' }] } } });
    await t.until(() => t.sent.some((m) => m.kind === ToView.Plugin));
    expect(t.sent.find((m) => m.kind === ToView.Plugin)).toEqual({ kind: ToView.Plugin, id: 7, result: { ok: true, value: { ok: true } } });
    expect(JSON.parse(readFileSync(join(t.root, 'package.json'), 'utf8')).dependencies.three).toBe('^0.180.0');
    expect(t.sent.find((m) => m.kind === ToView.History)).toMatchObject({ changes: [{ prop: 'plugin', value: '3D object' }], canUndo: true });
  });

  it('answers a refused proposal without writing', async () => {
    const t = setup();
    t.send({ kind: ToHost.Plugin, id: 8, ask: { call: PluginCall.Propose, proposal: { label: 'x', ops: [{ kind: OpKind.Asset, file: '../escape.txt', base64: 'AAAA' }] } } });
    await t.until(() => t.sent.some((m) => m.kind === ToView.Plugin));
    expect(t.sent.find((m) => m.kind === ToView.Plugin)).toMatchObject({ id: 8, result: { ok: true, value: { ok: false } } });
  });
});
