import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import FrameOverlays from './FrameOverlays.svelte';

const nothing = createRawSnippet(() => ({ render: () => '<i></i>' }));
const frame = { id: 'f1', x: 0, y: 0, w: 200, h: 100, bar: 0, doc: { width: 200, height: 100 } };
const view = { x: 0, y: 0, zoom: 1 };

describe('frame overlays on a rotated frame', () => {
  it('turns with the frame about its centre', () => {
    const body = render(FrameOverlays, { props: { view, frames: [{ ...frame, rotation: 30 }], children: nothing } }).body;

    expect(body).toContain('rotate:30deg');
    expect(body).toContain('transform-origin:50% 50%');
  });

  it('stays upright when the frame is not rotated', () => {
    const body = render(FrameOverlays, { props: { view, frames: [frame], children: nothing } }).body;

    expect(body).not.toContain('rotate:');
  });
});
