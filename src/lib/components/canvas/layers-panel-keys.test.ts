// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('svelte', async () => await import(join(dirname(fileURLToPath(import.meta.url)), '../../../../node_modules/svelte/src/index-client.js')));
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import LayersPanel from './LayersPanel.svelte';
import { layersSource, type VideoSide } from '$lib/canvas/layers-source.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

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
  { id: 'a', type: 'motion', name: 'Landing', head: 3 },
  { id: 'b', type: 'motion', name: 'Pricing', head: 3 }
];

const canvasSelect = vi.fn();
const videoSelect = vi.fn();
let app: Record<string, unknown> | null = null;
let unpublishCanvas = () => {};
let unpublishVideo = () => {};

const videoFor = (nodeId: string, name: string): VideoSide =>
  ({ nodeId, doc: docWith(name), selection: [], parts: {}, part: null, mode: 'design', select: videoSelect, selectPart: () => {}, edit: () => {}, run: () => {}, preview: () => {} }) as unknown as VideoSide;

const type = (value: string) => {
  const input = document.querySelector<HTMLInputElement>('[data-testid="layers-search"]')!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
};

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal('CSS', { escape: (s: string) => s });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  layersSource.setDocs(new Map([['a', docWith('Hero headline')], ['b', docWith('Hero price')]]));
  unpublishCanvas = layersSource.publishCanvas({ nodes: frames, selected: ['a'], select: canvasSelect, open: () => {}, rename: () => {}, flag: () => {} });
  unpublishVideo = layersSource.publishVideo(videoFor('a', 'Hero headline'));
  app = mount(LayersPanel, { target: document.body });
  flushSync();
});

afterEach(() => {
  if (app) {
    unmount(app);
    app = null;
  }
  unpublishVideo();
  unpublishCanvas();
  layersSource.setDocs(new Map());
  vi.unstubAllGlobals();
  canvasSelect.mockClear();
  videoSelect.mockClear();
  document.body.innerHTML = '';
});

describe('searching the Layers panel', () => {
  it('only finds layers of the current frame', () => {
    type('hero');

    expect(document.body.textContent).toContain('Hero headline');
    expect(document.body.textContent).not.toContain('Hero price');
  });
});

describe('Enter on a layer row', () => {
  it('selects its children and does not start a rename', () => {
    const frame = document.querySelector<HTMLElement>('[data-layer="a"]')!;
    frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    flushSync();

    expect(videoSelect).toHaveBeenCalledWith(['hero']);
    expect(document.querySelector('[data-testid="layer-rename"]')).toBeNull();
  });
});

describe('picking a layer of another frame', () => {
  it('selects the frame, then the layer once that frame opens', () => {
    const row = [...document.querySelectorAll<HTMLElement>('[data-layer="hero"]')].find((r) => r.textContent?.includes('Hero price'))!;
    row.click();
    flushSync();

    expect(canvasSelect).toHaveBeenCalledWith(['b']);

    unpublishVideo();
    unpublishVideo = layersSource.publishVideo(videoFor('b', 'Hero price'));
    flushSync();

    expect(videoSelect).toHaveBeenCalledWith(['hero']);
  });
});
