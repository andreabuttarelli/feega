import { describe, expect, it } from 'vitest';
import { Switch } from '$lib/canvas/gpu/renderer-flag';
import { createRendererSwitch } from './canvas-renderer-switch';

const flags = (on: boolean) => (async () => new Response(JSON.stringify({ flags: { 'canvas-force-dom': { enabled: on } } }))) as typeof fetch;

describe('canvas renderer kill switch', () => {
  it('the env forces DOM without asking PostHog', async () => {
    const read = createRendererSwitch({ forceDom: '1', posthogKey: 'k', fetch: flags(false), now: () => 0 });
    expect(await read()).toBe(Switch.ForceDom);
  });

  it('the PostHog flag forces DOM for everyone, and is cached for a minute', async () => {
    let calls = 0;
    let t = 0;
    const fetcher = (async (...args: Parameters<typeof fetch>) => {
      calls += 1;
      return flags(true)(...args);
    }) as typeof fetch;
    const read = createRendererSwitch({ forceDom: undefined, posthogKey: 'k', fetch: fetcher, now: () => t });
    expect(await read()).toBe(Switch.ForceDom);
    t = 30_000;
    await read();
    expect(calls).toBe(1);
    t = 61_000;
    await read();
    expect(calls).toBe(2);
  });

  it('an unreachable PostHog keeps the GPU canvas', async () => {
    const read = createRendererSwitch({ forceDom: undefined, posthogKey: 'k', fetch: (async () => { throw new Error('down'); }) as typeof fetch, now: () => 0 });
    expect(await read()).toBe(Switch.Open);
  });

  it('no key, no flag call', async () => {
    const read = createRendererSwitch({ forceDom: undefined, posthogKey: undefined, fetch: flags(true), now: () => 0 });
    expect(await read()).toBe(Switch.Open);
  });
});
