import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { Snap, frameAt, pxPerFrame, rulerTicks, snapped, timecode } from './timeline-view';

describe('timeline view', () => {
  it('at zoom 1 a second is 60 px', () => {
    expect(pxPerFrame(1) * 30).toBe(60);
    expect(frameAt(60, 1)).toBe(30);
  });

  it('labels the ruler in minutes, seconds and frames', () => {
    expect(timecode(0)).toBe('0:00.00');
    expect(timecode(95)).toBe('0:03.05');
  });

  it('ticks get denser as the zoom grows', () => {
    expect(rulerTicks(300, 4).length).toBeGreaterThan(rulerTicks(300, 1).length);
  });

  it('snaps to a whole second within a few pixels, unless snapping is off', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const input = { playhead: 0, exclude: [], zoom: 1 };

    expect(snapped(doc, 32, { ...input, snap: Snap.On })).toBe(30);
    expect(snapped(doc, 32, { ...input, snap: Snap.Off })).toBe(32);
  });
});
