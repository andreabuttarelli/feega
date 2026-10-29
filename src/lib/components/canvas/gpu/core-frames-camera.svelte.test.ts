// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@feega/motion-core/motion/gpu-full/display-list';

const calls = vi.hoisted(() => ({ cameras: [] as number[][], patches: [] as unknown[], overlays: 0, parts: [] as string[], frames: 0, puts: [] as string[], attached: 0, lose: false, splices: [] as { from: string; to: string; items: number }[] }));

vi.mock('@feega/motion-core/motion/gpu-full/core-web', () => ({
  createCore: () => {
    calls.attached++;
    const lost = calls.lose;
    calls.lose = false;
    return Promise.resolve({
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
    });
  },
  createCoreGl: () => new Promise(() => undefined)
}));

vi.mock('$lib/canvas/core/frame-source', () => ({ drawsAny: () => true, onStage: (l: unknown) => l, stillFrame: () => 0 }));

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
});
