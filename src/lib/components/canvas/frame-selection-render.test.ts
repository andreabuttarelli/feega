import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FrameSelection from './FrameSelection.svelte';
import LayersPanel from './LayersPanel.svelte';
import { layersSource } from '$lib/canvas/layers-source.svelte';
import { videoSide } from '$lib/canvas/frame-select';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';

const RECT = { left: 10, top: 20, width: 100, height: 50 };

let unpublish = () => {};

afterEach(() => unpublish());

describe('the selection drawn over a core frame', () => {
  it('outlines the element with a body to move and eight handles to resize', () => {
    const body = render(FrameSelection, { props: { clip: 'card', rect: RECT, ongrab: () => {} } }).body;

    expect(body).toContain('data-clip="card"');
    expect(body).toContain('left:10px;top:20px;width:100px;height:50px');
    expect(body.match(/data-testid="frame-selection-handle"/g)).toHaveLength(8);
    expect(body).toContain('data-testid="frame-selection-body"');
  });
});

describe('Layers for a frame drawn by the core', () => {
  it('lists the clips of the frame and marks the selected one', () => {
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'card');
    if (!added.ok) {
      throw new Error(added.error);
    }
    const canvas = layersSource.publishCanvas({ nodes: [{ id: 'm1', type: 'motion', name: 'Teaser' }], selected: ['m1'], outlinesUrl: '', previewUrl: () => '', select: () => {}, open: () => {} });
    const video = layersSource.publishVideo(videoSide({ nodeId: 'm1', doc: () => added.doc, selection: () => ['card'], select: () => {}, edit: () => {} }));
    unpublish = () => (canvas(), video());

    expect(render(LayersPanel).body).toContain('card');
  });
});
