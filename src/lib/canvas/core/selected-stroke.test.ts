import { describe, expect, it } from 'vitest';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import { stateChrome, type Glyphs } from './chrome';
import { strokeZoomStep } from './label-size';
import { Chrome, strokeZoomOf } from './settled-zoom';

const GLYPHS: Glyphs = () => ({ contours: [], width: 0, height: 0 });

const FRAME = { x: 100, y: 50, w: 400, h: 300 };

const RING_EDGE_PX = 3;
const STEP_SLACK_PX = 0.2;

function ringGapPx(strokeZoom: number, zoom: number): number {
  const items = stateChrome({ id: 'f', x: FRAME.x, y: FRAME.y, width: FRAME.w, height: FRAME.h, inputs: [], outputs: [], label: null, icon: null, tag: null, ring: NodeChrome.Selected, handles: false, ringColor: '#000', names: false, strokeZoom, radius: 0 } as never, GLYPHS);
  const xs = items.flatMap((i) => i.contours.flatMap((c) => c.filter((_, k) => k % 2 === 0)));
  return (FRAME.x - Math.min(...xs)) * zoom;
}

describe('strokeZoomOf', () => {
  it('the selected ring hugs its frame on every gesture frame while the resting steps stay held', () => {
    const held = strokeZoomStep(1);

    for (const zoom of [0.6, 0.8, 1, 1.4, 2.4]) {
      expect(Math.abs(ringGapPx(strokeZoomOf(Chrome.Selected, held, zoom), zoom) - RING_EDGE_PX)).toBeLessThan(STEP_SLACK_PX);
      expect(strokeZoomOf(Chrome.Resting, held, zoom)).toBe(held);
    }
  });
});
