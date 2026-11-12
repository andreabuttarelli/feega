// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const built = vi.hoisted(() => [] as string[][]);

vi.mock('@feega/motion-core/motion/gpu-full/core-web', () => ({
  createCore: () => new Promise(() => undefined),
  createCoreGl: () => new Promise(() => undefined)
}));

vi.mock('$lib/canvas/gpu/memory-budget', async (real) => {
  const actual = await real<typeof import('$lib/canvas/gpu/memory-budget')>();
  return { ...actual, currentDevice: () => actual.Device.Phone };
});

vi.mock('$lib/canvas/core/frame-source', async (real) => {
  const actual = await real<typeof import('$lib/canvas/core/frame-source')>();
  return { ...actual, toBuild: (...args: Parameters<typeof actual.toBuild>) => (built.push(args[0].map((f) => f.id)), []) };
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

const landing = { id: 'landing', kind: 'frame', revision: 1, box: { x: 0, y: 0, w: 1280, h: 9000 } };

describe('CoreFrames on a phone', () => {
  it('builds no frame while the canvas is zoomed out too far to read it, and builds it once zoomed in', async () => {
    const props = $state({ frames: [landing], cards: [], view: { x: 0, y: 0, zoom: 0.05 }, area: { width: 400, height: 800 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined });
    app = mount(CoreFrames, { target: document.body, props: props as never });
    flushSync();

    expect(built.at(-1)).toEqual([]);

    props.view = { x: 0, y: 0, zoom: 0.3 };
    flushSync();

    await vi.waitFor(() => expect(built.at(-1)).toEqual(['landing']));
  });
});
