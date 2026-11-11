// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@feega/motion-core/motion/gpu-full/display-list';

const calls = vi.hoisted(() => ({ cameras: [] as number[][], patches: [] as unknown[], overlays: 0, parts: [] as string[], frames: 0, puts: [] as string[], attached: 0, open: 0, overlapped: 0, lose: false, splices: [] as { from: string; to: string; items: number }[] }));

vi.mock('@feega/motion-core/motion/gpu-full/core-web', () => ({
  createCore: () => {
    calls.attached++;
    calls.overlapped = Math.max(calls.overlapped, calls.open);
    calls.open++;
    const lost = calls.lose;
    calls.lose = false;
    return Promise.resolve().then(() => (calls.open--, undefined)).then(() => ({
      lost: () => lost,
      pictureBytes: () => 0,
      putGroup: (key: string) => calls.puts.push(key),
      patchGroup: (from: string, to: string, splice: { items: unknown[] }) => (calls.splices.push({ from, to, items: splice.items.length }), true),
      appendGroup: () => undefined,
      dropGroup: () => undefined,
      upload: () => true,
      cacheBytes: () => 0,
      dispose: () => undefined,
      setCamera: (x: number, y: number, zoom: number) => calls.cameras.push([x, y, zoom]),
      patchUses: (patch: unknown) => calls.patches.push(patch),
      setOverlay: (part: string) => (calls.overlays++, calls.parts.push(part)),
      frame: () => {
        calls.frames++;
        return { outcome: 'reused', pending: false };
      }
    }));
  },
  createCoreGl: () => new Promise(() => undefined)
}));

const walks = vi.hoisted(() => ({} as Record<string, number>));
const walked = <F extends (...args: never[]) => unknown>(name: string, fn: F) => ((...args: Parameters<F>) => ((walks[name] = (walks[name] ?? 0) + 1), fn(...args))) as F;

vi.mock('$lib/canvas/core/frame-source', async (real) => {
  const actual = await real<typeof import('$lib/canvas/core/frame-source')>();
  return { ...actual, drawsAny: () => true, onStage: (l: unknown) => l, stillFrame: () => 0, toBuild: walked('toBuild', actual.toBuild), toWarm: walked('toWarm', actual.toWarm) };
});
vi.mock('$lib/canvas/core/placeholders', async (real) => {
  const actual = await real<typeof import('$lib/canvas/core/placeholders')>();
  return { ...actual, fillOrder: walked('fillOrder', actual.fillOrder), onScreenFirst: walked('onScreenFirst', actual.onScreenFirst) };
});
vi.mock('$lib/canvas/core/residency', async (real) => {
  const actual = await real<typeof import('$lib/canvas/core/residency')>();
  return { ...actual, resident: walked('resident', actual.resident), cached: walked('cached', actual.cached), uncached: walked('uncached', actual.uncached) };
});
vi.mock('$lib/canvas/core/screen-uses', async (real) => {
  const actual = await real<typeof import('$lib/canvas/core/screen-uses')>();
  return { ...actual, worldUses: walked('worldUses', actual.worldUses) };
});
vi.mock('$lib/canvas/core/spatial-index', async (real) => {
  const actual = await real<typeof import('$lib/canvas/core/spatial-index')>();
  class SpatialIndex extends actual.SpatialIndex {
    constructor(items: ConstructorParameters<typeof actual.SpatialIndex>[0]) {
      super(items);
      walks.index = (walks.index ?? 0) + 1;
    }
  }
  return { ...actual, SpatialIndex };
});

const { default: CoreFrames } = await import('./CoreFrames.svelte');
const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

let app: Record<string, unknown> | null = null;

afterEach(() => {
  if (app) {
    unmount(app);
  }
  app = null;
});

const card = { key: 'c1', frame: { id: 'c1', box: { x: 0, y: 0, w: 100, h: 50 }, list: { width: 100, height: 50, background: null, items: [], unsupported: [] } } };

describe('CoreFrames camera', () => {
  it('a pan sends the core only the camera, never the scene again', async () => {
    const props = $state({ frames: [], cards: [card], view: { x: 0, y: 0, zoom: 1 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();
    await vi.waitFor(() => expect(calls.patches.length).toBeGreaterThan(0));
    const sent = calls.patches.length;
    const overlays = calls.overlays;

    props.view = { x: 40, y: 0, zoom: 1 };
    flushSync();

    await vi.waitFor(() => expect(calls.cameras.at(-1)).toEqual([40, 0, 1]));
    expect(calls.patches.length).toBe(sent);
    expect(calls.overlays).toBe(overlays);
  });

  it('a hover change sends the core only the live overlay', async () => {
    const wire = { kind: 'path', clip: 'e:wire', contours: [[0, 0, 10, 0]], rule: 'nonzero', paint: { kind: 'solid', color: [0, 0, 0, 1] }, opacity: 1, matrix: [1, 0, 0, 1, 0, 0] };
    const fixed = [wire];
    const props = $state({ frames: [], cards: [card], overlay: { fixed, live: [] as unknown[] }, view: { x: 0, y: 0, zoom: 1 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    app = mount(CoreFrames, { target: document.body, props: props as never });
    flushSync();
    await vi.waitFor(() => expect(calls.parts).toContain('fixed'));
    calls.parts.length = 0;

    props.overlay = { fixed, live: [{ ...wire, clip: 'n:hover' }] };
    flushSync();

    await vi.waitFor(() => expect(calls.parts).toEqual(['live']));
  });

  it('draws nodes in the canvas stacking order, not cards before frames', async () => {
    const other = { key: 'c2', frame: { id: 'c2', box: { x: 0, y: 0, w: 100, h: 50 }, list: { width: 100, height: 50, background: null, items: [], unsupported: [] } } };
    const props = $state({ frames: [], cards: [card, other], order: ['c2', 'c1'], view: { x: 0, y: 0, zoom: 1 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    calls.patches.length = 0;
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();
    await vi.waitFor(() => expect(calls.patches.length).toBeGreaterThan(0));

    const put = (calls.patches[0] as { put: { clip: string }[] }).put.map((u) => u.clip);
    expect(put).toEqual(['c2', 'c1']);
  });

  it('an edit to one item sends the core that item, not the whole group again', async () => {
    const bar = (n: number, red: number) => ({ kind: 'path', clip: `bar${n}`, contours: [[n, 0, n + 5, 0, n + 5, 5]], paint: { kind: 'solid', color: [red, 0, 0, 1] }, opacity: 1, matrix: [1, 0, 0, 1, 0, 0] });
    const items = Array.from({ length: 40 }, (_, i) => bar(i, 1));
    const sized = (list: unknown[]) => ({ width: 100, height: 50, background: null, items: list as Item[], unsupported: [] });
    const first = { key: 'e1:a', frame: { id: 'e1', box: { x: 0, y: 0, w: 100, h: 50 }, list: sized(items) } };
    const props = $state({ frames: [], cards: [first], view: { x: 0, y: 0, zoom: 1 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    calls.puts.length = 0;
    calls.splices.length = 0;
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();
    await vi.waitFor(() => expect(calls.puts).toContain('e1:a'));
    await vi.waitFor(() => expect(calls.patches.length).toBeGreaterThan(0));
    const puts = calls.puts.length;

    props.cards = [{ key: 'e1:b', frame: { ...first.frame, list: sized(items.map((item, i) => (i === 35 ? bar(35, 0.5) : item))) } }];
    flushSync();

    await vi.waitFor(() => expect(calls.splices).toEqual([{ from: 'e1:a', to: 'e1:b', items: 1 }]));
    expect(calls.puts.length).toBe(puts);
  });

  it('a lost GPU device is attached again instead of leaving the canvas dead', async () => {
    calls.lose = true;
    calls.attached = 0;
    const props = $state({ frames: [], cards: [card], view: { x: 0, y: 0, zoom: 1 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();

    await vi.waitFor(() => expect(calls.attached).toBe(2));
  });

  it('a new area object of the same size keeps the gpu attached once, or WebKit loses the device that won', async () => {
    const props = $state({ frames: [], cards: [card], view: { x: 0, y: 0, zoom: 1 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();
    await vi.waitFor(() => expect(calls.patches.length).toBeGreaterThan(0));
    const attached = calls.attached;

    props.area = { width: 100, height: 80 };
    flushSync();
    await new Promise((r) => setTimeout(r, 20));

    expect(calls.attached).toBe(attached);
  });

  it('a resize while the gpu is attaching waits for that attach, or freeing it kills the one after on the same canvas', async () => {
    const props = $state({ frames: [], cards: [card], view: { x: 0, y: 0, zoom: 1 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    calls.overlapped = 0;
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();
    props.area = { width: 120, height: 80 };
    flushSync();
    await vi.waitFor(() => expect(calls.open).toBe(0));
    await new Promise((r) => setTimeout(r, 20));

    expect(calls.overlapped).toBe(0);
  });

  const manyCards = () => Array.from({ length: 200 }, (_, i) => ({ key: `k${i}`, frame: { id: `k${i}`, box: { x: i * 120, y: 0, w: 100, h: 50 }, list: { width: 100, height: 50, background: null, items: [], unsupported: [] } } }));
  const QUIET_MS = 100;
  const SETTLE_MS = 5000;
  const forget = () => {
    for (const name of Object.keys(walks)) {
      delete walks[name];
    }
  };
  const settled = () =>
    vi.waitFor(
      async () => {
        forget();
        await new Promise((r) => setTimeout(r, QUIET_MS));
        expect(walks).toEqual({});
      },
      { timeout: SETTLE_MS }
    );

  it('a pan that shows the same frames walks none of them, however many there are', async () => {
    const props = $state({ frames: [], cards: manyCards(), view: { x: 0, y: 0, zoom: 1 }, area: { width: 400, height: 300 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();
    await vi.waitFor(() => expect(calls.patches.length).toBeGreaterThan(0));
    await settled();

    props.view = { x: -1, y: 0, zoom: 1 };
    flushSync();

    await vi.waitFor(() => expect(calls.cameras.at(-1)).toEqual([-1, 0, 1]));
    expect(walks).toEqual({});
  });

  it('a short pan that brings a card across the screen edge walks none of them', async () => {
    const props = $state({ frames: [], cards: manyCards(), view: { x: 0, y: 0, zoom: 1 }, area: { width: 400, height: 300 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();
    await vi.waitFor(() => expect(calls.patches.length).toBeGreaterThan(0));
    await settled();

    props.view = { x: -90, y: 0, zoom: 1 };
    flushSync();

    await vi.waitFor(() => expect(calls.cameras.at(-1)).toEqual([-90, 0, 1]));
    expect(walks).toEqual({});
  });

  it('a zoom that stays in one cache step walks none of them after its first tick', async () => {
    const props = $state({ frames: [], cards: manyCards(), view: { x: 0, y: 0, zoom: 1 }, area: { width: 400, height: 300 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();
    await vi.waitFor(() => expect(calls.patches.length).toBeGreaterThan(0));
    await settled();
    props.view = { x: 0, y: 0, zoom: 1.001 };
    flushSync();
    await vi.waitFor(() => expect(calls.cameras.at(-1)).toEqual([0, 0, 1.001]));
    forget();

    props.view = { x: 0, y: 0, zoom: 1.002 };
    flushSync();

    await vi.waitFor(() => expect(calls.cameras.at(-1)).toEqual([0, 0, 1.002]));
    expect(walks).toEqual({});
  });
});
