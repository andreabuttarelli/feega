// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const tried = vi.hoisted(() => ({ webgpu: [] as HTMLCanvasElement[], webgl: [] as HTMLCanvasElement[] }));

vi.mock('$lib/motion/gpu-full/core-web', () => ({
  createCore: (canvas: HTMLCanvasElement) => {
    tried.webgpu.push(canvas);
    return Promise.reject(new Error('no adapter'));
  },
  createCoreGl: (canvas: HTMLCanvasElement) => {
    tried.webgl.push(canvas);
    return new Promise(() => undefined);
  }
}));

vi.mock('$lib/canvas/core/frame-source', () => ({ drawsWhole: () => true, onStage: (l: unknown) => l, stillFrame: () => 0 }));

const { default: CoreFrames } = await import('./CoreFrames.svelte');
const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

let app: Record<string, unknown> | null = null;

afterEach(() => {
  tried.webgpu.length = 0;
  tried.webgl.length = 0;
  if (app) {
    unmount(app);
  }
  app = null;
});

describe('CoreFrames dot grid', () => {
  it('paints the dots on a layer of their own, since the core canvas sits above the tiles the scene still draws', () => {
    app = mount(CoreFrames, { target: document.body, props: { frames: [], view: { x: 30, y: -10, zoom: 2 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined } });
    flushSync();

    const core = document.querySelector<HTMLElement>('[data-testid="core-canvas"]')!;
    const grid = document.querySelector<HTMLElement>('[data-testid="core-grid"]')!;

    expect(core.style.backgroundImage).toBe('');
    expect(grid.style.backgroundSize).toBe('48px 48px');
  });
});

describe('CoreFrames backends', () => {
  it('gives WebGL2 a canvas WebGPU never touched, since a canvas keeps the first context it hands out', async () => {
    app = mount(CoreFrames, { target: document.body, props: { frames: [], view: { x: 0, y: 0, zoom: 1 }, area: { width: 100, height: 80 }, sourceUrl: (id: string) => id, onready: () => undefined, onfallback: () => undefined } });
    flushSync();

    await vi.waitFor(() => expect(tried.webgl).toHaveLength(1));

    expect(tried.webgpu).toHaveLength(1);
    expect(tried.webgl[0]).not.toBe(tried.webgpu[0]);
    expect(tried.webgl[0].isConnected).toBe(true);
  });
});
