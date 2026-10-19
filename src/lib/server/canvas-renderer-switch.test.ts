import { describe, expect, it } from 'vitest';
import { Switch } from '$lib/canvas/gpu/renderer-flag';
import { createRendererSwitch } from './canvas-renderer-switch';

const flags = (on: boolean, coreOff = false) => (async () => new Response(JSON.stringify({ flags: { 'canvas-force-dom': { enabled: on }, 'canvas-core-off': { enabled: coreOff } } }))) as typeof fetch;

describe('canvas renderer kill switch', () => {
  it('the env forces DOM without asking PostHog', async () => {
    const read = createRendererSwitch({ forceDom: '1', coreOff: undefined, posthogKey: 'k', fetch: flags(false), now: () => 0 });
    expect(await read()).toBe(Switch.ForceDom);
  });

  it('the PostHog flag forces DOM for everyone, and is cached for a minute', async () => {
    let calls = 0;
    let t = 0;
    const fetcher = (async (...args: Parameters<typeof fetch>) => {
      calls += 1;
      return flags(true)(...args);
    }) as typeof fetch;
    const read = createRendererSwitch({ forceDom: undefined, coreOff: undefined, posthogKey: 'k', fetch: fetcher, now: () => t });
    expect(await read()).toBe(Switch.ForceDom);
    t = 30_000;
    await read();
    expect(calls).toBe(1);
    t = 61_000;
    await read();
    expect(calls).toBe(2);
  });

  it('an unreachable PostHog keeps the GPU canvas', async () => {
    const read = createRendererSwitch({ forceDom: undefined, coreOff: undefined, posthogKey: 'k', fetch: (async () => { throw new Error('down'); }) as typeof fetch, now: () => 0 });
    expect(await read()).toBe(Switch.Open);
  });

  it('the core kill flag sends everyone to the Pixi canvas, the DOM flag beats it', async () => {
    expect(await createRendererSwitch({ forceDom: undefined, coreOff: undefined, posthogKey: 'k', fetch: flags(false, true), now: () => 0 })()).toBe(Switch.CoreOff);
    expect(await createRendererSwitch({ forceDom: undefined, coreOff: undefined, posthogKey: 'k', fetch: flags(true, true), now: () => 0 })()).toBe(Switch.ForceDom);
  });

  it('the env turns the core off without asking PostHog', async () => {
    expect(await createRendererSwitch({ forceDom: undefined, coreOff: '1', posthogKey: 'k', fetch: flags(false), now: () => 0 })()).toBe(Switch.CoreOff);
  });

  it('no key, no flag call', async () => {
    const read = createRendererSwitch({ forceDom: undefined, coreOff: undefined, posthogKey: undefined, fetch: flags(true), now: () => 0 });
    expect(await read()).toBe(Switch.Open);
  });
});
