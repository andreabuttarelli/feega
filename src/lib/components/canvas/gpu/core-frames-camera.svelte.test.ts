// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ cameras: [] as number[][], patches: [] as unknown[], overlays: 0, frames: 0 }));

vi.mock('$lib/motion/gpu-full/core-web', () => ({
  createCore: () =>
    Promise.resolve({
      putGroup: () => undefined,
      appendGroup: () => undefined,
      dropGroup: () => undefined,
      upload: () => true,
      cacheBytes: () => 0,
      dispose: () => undefined,
      setCamera: (x: number, y: number, zoom: number) => calls.cameras.push([x, y, zoom]),
      patchUses: (patch: unknown) => calls.patches.push(patch),
      setOverlay: () => calls.overlays++,
      frame: () => {
        calls.frames++;
        return { outcome: 'reused', pending: false };
      }
    }),
  createCoreGl: () => new Promise(() => undefined)
}));

vi.mock('$lib/canvas/core/frame-source', () => ({ drawsWhole: () => true, onStage: (l: unknown) => l, stillFrame: () => 0 }));

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

  it('a node the live editor shows is left out of the core, and drawn again when it hands back', async () => {
    const props = $state({ frames: [], cards: [card], hidden: new Set(['c1']), view: { x: 0, y: 0, zoom: 1 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    calls.patches.length = 0;
    calls.cameras.length = 0;
    app = mount(CoreFrames, { target: document.body, props });
    flushSync();
    await vi.waitFor(() => expect(calls.cameras.length).toBeGreaterThan(0));
    const put = () => calls.patches.flatMap((p) => (p as { put: { clip: string }[] }).put.map((u) => u.clip));
    expect(put()).not.toContain('c1');

    props.hidden = new Set();
    flushSync();

    await vi.waitFor(() => expect(put()).toContain('c1'));
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
});
