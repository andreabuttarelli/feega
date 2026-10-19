import { describe, expect, it } from 'vitest';
import { EXTRAPOLATE_MS, SNAP_PX, playout } from './playout';

const feed = (track: ReturnType<typeof playout>, gaps: number, lateness: (i: number) => number) => {
  for (let i = 0; i < gaps; i += 1) {
    track.push(i * 33, 1000 + i * 33 + lateness(i), { x: i, y: 0 });
  }
};


const at = (track: ReturnType<typeof playout>, now: number) => track.sample(now);

describe('playout: remote motion drawn between the samples it received', () => {
  it('draws in between two samples instead of jumping from one to the next', () => {
    const track = playout();
    track.push(0, 1000, { x: 0, y: 0 });
    track.push(50, 1050, { x: 100, y: 0 });

    const mid = at(track, 1050 + track.delay() - 25);
    expect(mid?.x).toBeGreaterThan(0);
    expect(mid?.x).toBeLessThan(100);
  });

  it('uses the sender clock, so network jitter does not bunch the motion', () => {
    const track = playout();
    track.push(0, 1000, { x: 0, y: 0 });
    track.push(50, 1120, { x: 50, y: 0 });
    track.push(100, 1121, { x: 100, y: 0 });

    const a = at(track, 1000 + track.delay() + 25)!.x;
    const b = at(track, 1000 + track.delay() + 75)!.x;
    expect(b - a).toBeCloseTo(50, 0);
  });

  it('keeps going briefly when samples stop, then settles where the sender stopped', () => {
    const track = playout();
    track.push(0, 1000, { x: 0, y: 0 });
    track.push(50, 1050, { x: 50, y: 0 });

    const past = at(track, 1050 + track.delay() + 20)!.x;
    expect(past).toBeGreaterThan(50);
    const later = at(track, 1050 + track.delay() + EXTRAPOLATE_MS * 5)!.x;
    expect(later).toBe(50);
  });

  it('snaps on a big jump instead of sliding across the canvas', () => {
    const track = playout();
    track.push(0, 1000, { x: 0, y: 0 });
    track.push(50, 1050, { x: SNAP_PX * 2, y: 0 });

    const mid = at(track, 1050 + track.delay() - 25)!.x;
    expect([0, SNAP_PX * 2]).toContain(mid);
  });

  it('a single sample is drawn where it is', () => {
    const track = playout();
    track.push(0, 1000, { x: 7, y: 9 });
    expect(at(track, 1001)).toEqual({ x: 7, y: 9 });
  });
});

describe('adaptive playout delay', () => {
  it('on a steady connection the delay shrinks to about one gap', () => {
    const track = playout();
    feed(track, 60, () => 0);
    expect(track.delay()).toBeLessThan(50);
  });

  it('jittery arrivals grow the delay', () => {
    const steady = playout();
    const jittery = playout();
    feed(steady, 60, () => 0);
    feed(jittery, 60, (i) => (i % 3 === 0 ? 60 : 0));
    expect(jittery.delay()).toBeGreaterThan(steady.delay() + 20);
  });

  it('the delay changes gradually, never in one jump', () => {
    const track = playout();
    feed(track, 60, () => 0);
    const before = track.delay();
    track.push(60 * 33, 1000 + 60 * 33 + 200, { x: 60, y: 0 });
    expect(track.delay() - before).toBeLessThan(30);
  });
});
