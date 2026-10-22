import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FrameSelection from './FrameSelection.svelte';
import { SelectionKind } from '$lib/canvas/frame-transform';
import FrameGuides from './FrameGuides.svelte';
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

  it('offers four rotate targets outside the corners', () => {
    const body = render(FrameSelection, { props: { clip: 'card', rect: RECT, ongrab: () => {} } }).body;

    expect(body.match(/data-testid="frame-selection-rotate"/g)).toHaveLength(4);
  });

  it('draws a member of a group as an outline the group box transforms', () => {
    const body = render(FrameSelection, { props: { clip: 'card', rect: RECT, kind: SelectionKind.Member, ongrab: () => {} } }).body;

    expect(body).toContain('data-testid="frame-selection"');
    expect(body).not.toContain('frame-selection-handle');
    expect(body).not.toContain('frame-selection-rotate');
  });

  it('draws the group box with its own handles', () => {
    const body = render(FrameSelection, { props: { clip: '', rect: RECT, kind: SelectionKind.Group, ongrab: () => {} } }).body;

    expect(body).toContain('data-testid="frame-group-selection"');
    expect(body.match(/data-testid="frame-selection-handle"/g)).toHaveLength(8);
  });
});

describe('guides drawn over a core frame', () => {
  it('labels a measured gap in frame pixels', () => {
    const body = render(FrameGuides, { props: { area: RECT, size: { width: 200, height: 100 }, guides: [{ axis: 'x', at: 50 }], gaps: [], measured: [{ axis: 'x', from: 20, to: 62.4, at: 10 }] } }).body;

    expect(body).toContain('data-testid="frame-guide"');
    expect(body).toContain('data-testid="frame-measure-label"');
    expect(body).toContain('>42<');
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
