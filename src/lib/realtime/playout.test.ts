import { describe, expect, it } from 'vitest';
import { EXTRAPOLATE_MS, SNAP_PX, playout } from './playout';

const THREE_GAPS_MS = 150;

const at = (track: ReturnType<typeof playout>, now: number) => track.sample(now);

describe('playout: remote motion drawn between the samples it received', () => {
  it('draws in between two samples instead of jumping from one to the next', () => {
    const track = playout();
    track.push(0, 1000, { x: 0, y: 0 });
    track.push(50, 1050, { x: 100, y: 0 });

    const mid = at(track, 1050 + THREE_GAPS_MS - 25);
    expect(mid?.x).toBeGreaterThan(0);
    expect(mid?.x).toBeLessThan(100);
  });

  it('uses the sender clock, so network jitter does not bunch the motion', () => {
    const track = playout();
    track.push(0, 1000, { x: 0, y: 0 });
    track.push(50, 1120, { x: 50, y: 0 });
    track.push(100, 1121, { x: 100, y: 0 });

    const a = at(track, 1000 + THREE_GAPS_MS + 25)!.x;
    const b = at(track, 1000 + THREE_GAPS_MS + 75)!.x;
    expect(b - a).toBeCloseTo(50, 0);
  });

  it('keeps going briefly when samples stop, then settles where the sender stopped', () => {
    const track = playout();
    track.push(0, 1000, { x: 0, y: 0 });
    track.push(50, 1050, { x: 50, y: 0 });

    const past = at(track, 1050 + THREE_GAPS_MS + 20)!.x;
    expect(past).toBeGreaterThan(50);
    const later = at(track, 1050 + THREE_GAPS_MS + EXTRAPOLATE_MS * 5)!.x;
    expect(later).toBe(50);
  });

  it('snaps on a big jump instead of sliding across the canvas', () => {
    const track = playout();
    track.push(0, 1000, { x: 0, y: 0 });
    track.push(50, 1050, { x: SNAP_PX * 2, y: 0 });

    const mid = at(track, 1050 + THREE_GAPS_MS - 25)!.x;
    expect([0, SNAP_PX * 2]).toContain(mid);
  });

  it('a single sample is drawn where it is', () => {
    const track = playout();
    track.push(0, 1000, { x: 7, y: 9 });
    expect(at(track, 1001)).toEqual({ x: 7, y: 9 });
  });
});
