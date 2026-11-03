// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('svelte', async () => await import(join(dirname(fileURLToPath(import.meta.url)), '../../../../node_modules/svelte/src/index-client.js')));
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import LayersPanel from './LayersPanel.svelte';
import { layersSource, type VideoSide } from '$lib/canvas/layers-source.svelte';
import { Place } from '$lib/motion/layer-place';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const shape = (id: string, parent?: string) => ({ id, name: id, from: 0, durationInFrames: 60, component: 'Shape', props: { shape: 'rect' }, ...(parent ? { parent } : {}) });

const frameDoc = {
  version: 5,
  fps: 30,
  width: 390,
  height: 844,
  durationInFrames: 60,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ ...shape('row'), name: 'Row', component: 'Shape', autoLayout: { direction: 'vertical', gap: 8, padding: 0, align: 'start', order: ['inside'] } }, shape('inside', 'row')] }],
  comps: {},
  assets: []
} as unknown as MotionDoc;

const nodes = [
  { id: 'frame', type: 'motion', name: 'Phone', head: 1 },
  { id: 'free', type: 'motion', name: 'Badge', head: 1, element: true }
];

const moveInto = vi.fn();
let app: Record<string, unknown> | null = null;
let unpublishCanvas = () => {};
let unpublishVideo = () => {};

const video = { nodeId: 'frame', doc: frameDoc, selection: [], parts: {}, part: null, mode: 'design', select: () => {}, selectPart: () => {}, edit: () => {}, run: () => {}, preview: () => {} } as unknown as VideoSide;

const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-layer="${id}"]`)!;

function dragOnto(from: string, onto: string) {
  rowOf(from).dispatchEvent(new Event('dragstart', { bubbles: true }));
  flushSync();
  rowOf(onto).dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
  flushSync();
  const shown = rowOf(onto).dataset.drop;
  rowOf(onto).dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
  flushSync();
  return shown;
}

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal('CSS', { escape: (s: string) => s });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  unpublishCanvas = layersSource.publishCanvas({ nodes, selected: [], select: () => {}, open: () => {}, rename: () => {}, flag: () => {}, moveInto });
  unpublishVideo = layersSource.publishVideo(video);
  app = mount(LayersPanel, { target: document.body, props: { searching: false } });
  flushSync();
});

afterEach(() => {
  if (app) {
    unmount(app);
    app = null;
  }
  unpublishVideo();
  unpublishCanvas();
  vi.unstubAllGlobals();
  moveInto.mockClear();
  document.body.innerHTML = '';
});

describe('dragging a free element row in Layers', () => {
  it('can be picked up', () => {
    expect(rowOf('free').getAttribute('draggable')).toBe('true');
  });

  it('dropped on a frame row moves it into that frame, with the row marked while over it', () => {
    expect(dragOnto('free', 'frame')).toBe(Place.Into);
    expect(moveInto).toHaveBeenCalledWith('free', 'frame', undefined);
  });

  it('dropped on a stack inside the frame joins that stack', () => {
    expect(dragOnto('free', 'row')).toBe(Place.Into);
    expect(moveInto).toHaveBeenCalledWith('free', 'frame', { target: 'row', place: Place.Into });
  });
});
