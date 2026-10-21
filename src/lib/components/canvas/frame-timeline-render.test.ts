import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FrameTimeline from './FrameTimeline.svelte';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';

describe('the timeline under a frame on the canvas', () => {
  it('shows the playhead time and a play button for the selected frame', () => {
    const doc = newMotionDoc(MotionFormat.Landscape);
    const body = render(FrameTimeline, { props: { doc, frame: 45, selection: [], onframe: () => {}, onselect: () => {}, onchange: () => {} } }).body;

    expect(body).toContain('data-testid="frame-timeline"');
    expect(body).toContain('data-testid="frame-timeline-play"');
    expect(body).toContain(`${(45 / doc.fps).toFixed(2)}s`);
  });
});
