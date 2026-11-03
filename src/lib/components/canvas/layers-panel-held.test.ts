// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('svelte', async () => await import(join(dirname(fileURLToPath(import.meta.url)), '../../../../node_modules/svelte/src/index-client.js')));
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import LayersPanel from './LayersPanel.svelte';
import { layersSource } from '$lib/canvas/layers-source.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const IDLE_WAIT_MS = 200;

const docWith = (name: string) =>
  ({
    version: 5,
    fps: 30,
    width: 1440,
    height: 900,
    durationInFrames: 60,
    tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'hero', name, from: 0, durationInFrames: 60, component: 'Text', props: { text: name } }] }],
    comps: {},
    assets: []
  }) as unknown as MotionDoc;

const frames = [
  { id: 'loaded', type: 'motion', name: 'Landing', head: 3 },
  { id: 'far', type: 'motion', name: 'Pricing page', head: 7 }
];

let app: Record<string, unknown> | null = null;
let unpublish = () => {};
const fetched = vi.fn(() => Promise.resolve(new Response('{}')));

beforeEach(() => {
  vi.stubGlobal('fetch', fetched);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  layersSource.setDocs(new Map([['loaded', docWith('Hero headline')]]));
  unpublish = layersSource.publishCanvas({ nodes: frames, selected: [], select: () => {}, open: () => {}, rename: () => {}, flag: () => {}, moveInto: () => {} });
  app = mount(LayersPanel, { target: document.body, props: { searching: false } });
  flushSync();
});

afterEach(() => {
  if (app) {
    unmount(app);
    app = null;
  }
  unpublish();
  layersSource.setDocs(new Map());
  vi.unstubAllGlobals();
  fetched.mockClear();
  document.body.innerHTML = '';
});

describe('the Layers tree is built from what the canvas loaded', () => {
  it('fetches nothing of its own, not even when idle', async () => {
    await new Promise((resolve) => setTimeout(resolve, IDLE_WAIT_MS));

    expect(fetched).not.toHaveBeenCalled();
  });

  it('lists the children of a frame the canvas holds', () => {
    expect(document.body.textContent).toContain('Hero headline');
  });

  it('shows a frame the canvas has not loaded as its row alone', () => {
    expect(document.body.textContent).toContain('Pricing page');
    expect(document.querySelectorAll('[role="treeitem"]')).toHaveLength(3);
  });
});
