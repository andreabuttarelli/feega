import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FrameTimeline from './FrameTimeline.svelte';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { EditMode } from '$lib/motion/edit-mode';

describe('the timeline under a frame on the canvas', () => {
  it('shows the playhead time and a play button for the selected frame', () => {
    const doc = newMotionDoc(MotionFormat.Landscape);
    const body = render(FrameTimeline, { props: { doc, frame: 45, selection: [], onframe: () => {}, onselect: () => {}, onchange: () => {} } }).body;

    expect(body).toContain('data-testid="frame-timeline"');
    expect(body).toContain('data-testid="frame-timeline-play"');
    expect(body).toContain(`${(45 / doc.fps).toFixed(2)}s`);
  });

  const two = (() => {
    const a = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'a');
    return addClip(a.ok ? a.doc : newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'b');
  })();
  const docOf = two.ok ? two.doc : newMotionDoc(MotionFormat.Landscape);
  const props = { doc: docOf, frame: 0, onframe: () => {}, onselect: () => {}, onchange: () => {} };

  it('offers Group once two segments are selected, and not for one', () => {
    expect(render(FrameTimeline, { props: { ...props, selection: ['a', 'b'] } }).body).toContain('data-testid="frame-timeline-group"');
    expect(render(FrameTimeline, { props: { ...props, selection: ['a'] } }).body).not.toContain('data-testid="frame-timeline-group"');
  });

  it('shows which mode the edits are in', () => {
    expect(render(FrameTimeline, { props: { ...props, selection: [], mode: EditMode.Design } }).body).toContain('data-mode="design"');
    expect(render(FrameTimeline, { props: { ...props, selection: [] } }).body).toContain('data-mode="motion"');
  });

  it('draws a marker per timed comment and a pin-at-playhead button when asked', () => {
    const marks = [{ id: 'c1', number: 2, frame: 30 }];
    const body = render(FrameTimeline, { props: { ...props, selection: [], marks, onpin: () => {} } }).body;

    expect(body).toContain('data-testid="frame-timeline-mark"');
    expect(body).toContain('data-testid="frame-timeline-pin"');
    expect(render(FrameTimeline, { props: { ...props, selection: [] } }).body).not.toContain('frame-timeline-mark');
  });
});
