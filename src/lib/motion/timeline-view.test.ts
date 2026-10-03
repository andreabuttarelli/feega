import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { Grip, HANDLE_PX, Snap, edgeHandles, frameAt, handleAt, pxPerFrame, rulerTicks, snapped, timecode } from './timeline-view';

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

  it('the end edge of a clip under a later overlapping clip can still be grabbed', () => {
    const kicker = { id: 'k', from: 0, durationInFrames: 90 };
    const title = { id: 't', from: 24, durationInFrames: 90 };
    const handles = edgeHandles([kicker, title], 3);

    expect(handleAt(handles, 90 * 3 - 2)).toMatchObject({ clipId: 'k', grip: Grip.End });
    expect(handleAt(handles, 24 * 3 + 2)).toMatchObject({ clipId: 't', grip: Grip.Start });
    expect(handleAt(handles, 50 * 3)).toBeNull();
  });

  it('two touching clips split the seam: left of it trims the first, right of it the second', () => {
    const handles = edgeHandles(
      [
        { id: 'a', from: 0, durationInFrames: 30 },
        { id: 'b', from: 30, durationInFrames: 30 }
      ],
      3
    );

    expect(handleAt(handles, 90 - 1)).toMatchObject({ clipId: 'a', grip: Grip.End });
    expect(handleAt(handles, 90 + 1)).toMatchObject({ clipId: 'b', grip: Grip.Start });
  });

  it('a tiny clip keeps a body to drag between its two edges', () => {
    const [start, end] = edgeHandles([{ id: 'a', from: 0, durationInFrames: 3 }], 3);

    expect(start.width).toBeLessThan(HANDLE_PX);
    expect(start.left + start.width).toBeLessThan(end.left);
  });
});
