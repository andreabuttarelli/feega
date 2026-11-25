import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { editorRegistry } from './editors';
import { publishBridge } from './publish';

const rig = () => {
  let clock = 100;
  const registry = editorRegistry({ dir: mkdtempSync(join(tmpdir(), 'feega-pub-')), alive: () => true });
  const state = { selection: () => 'ctx', changes: () => [], screenshot: async () => null, context: async () => null };
  return { registry, publish: () => publishBridge({ registry, projectRoot: '/work/shop', state, pid: 7, now: () => clock }), tick: (to: number) => (clock = to) };
};

describe('publishBridge', () => {
  it('registers the editor with its port and token', async () => {
    const { registry, publish } = rig();
    const bridge = await publish();

    expect(registry.list()).toEqual([{ projectRoot: '/work/shop', port: expect.any(Number), token: expect.any(String), pid: 7, lastActiveAt: 100 }]);
    await bridge.stop();
  });

  it('touch refreshes when the editor was last active', async () => {
    const { registry, publish, tick } = rig();
    const bridge = await publish();
    tick(250);
    bridge.touch();

    expect(registry.list()[0].lastActiveAt).toBe(250);
    await bridge.stop();
  });

  it('stop unregisters and closes', async () => {
    const { registry, publish } = rig();
    const bridge = await publish();
    await bridge.stop();

    expect(registry.list()).toEqual([]);
  });
});
