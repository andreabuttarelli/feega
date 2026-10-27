import { describe, expect, it } from 'vitest';
import { movingSquare, SQUARE_SIZE } from './scene';
import { Adapt, DEFAULT_TRACK, Direction, trackFrom } from './point-tracker';

const W = 160;
const H = 90;
const CENTRE = SQUARE_SIZE / 2;
const STEP_X = 3;
const STEP_Y = 1;

const squareAt = (i: number) => movingSquare(W, H, 20 + i * STEP_X, 20 + i * STEP_Y);
const centreAt = (i: number) => ({ x: (20 + i * STEP_X + CENTRE) / W, y: (20 + i * STEP_Y + CENTRE) / H });
const frames = (count: number) => Array.from({ length: count }, (_, i) => squareAt(i));
const options = { ...DEFAULT_TRACK, feature: 0.05 };

describe('point tracker', () => {
  it('follows a square moving across a textured background to within a pixel', () => {
    const { samples, lost } = trackFrom(frames(30), 0, centreAt(0), Direction.Forward, options);

    expect(lost).toBe(false);
    expect(samples).toHaveLength(30);
    for (const s of samples) {
      expect(Math.abs(s.x - centreAt(s.index).x) * W).toBeLessThan(1);
      expect(Math.abs(s.y - centreAt(s.index).y) * H).toBeLessThan(1);
    }
  });

  it('tracks backward from the last frame to the first', () => {
    const { samples } = trackFrom(frames(20), 19, centreAt(19), Direction.Backward, options);

    expect(samples.map((s) => s.index)).toEqual(Array.from({ length: 20 }, (_, i) => 19 - i));
    expect(Math.abs(samples[19].x - centreAt(0).x) * W).toBeLessThan(1);
  });

  it('keeps the point on a square that jumps several pixels per frame', () => {
    const lumas = Array.from({ length: 8 }, (_, i) => movingSquare(W, H, 10 + i * 9, 30));

    const { samples, lost } = trackFrom(lumas, 0, { x: (10 + CENTRE) / W, y: (30 + CENTRE) / H }, Direction.Forward, options);

    expect(lost).toBe(false);
    expect(Math.abs(samples[7].x - (10 + 63 + CENTRE) / W) * W).toBeLessThan(1);
  });

  it('stops and says so when the feature is gone', () => {
    const blackout = { width: W, height: H, data: new Uint8Array(W * H) };
    const lumas = [...frames(5), blackout, ...frames(3)];

    const { samples, lost } = trackFrom(lumas, 0, centreAt(0), Direction.Forward, options);

    expect(lost).toBe(true);
    expect(samples.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('adapting the feature each frame still follows the square', () => {
    const { samples, lost } = trackFrom(frames(30), 0, centreAt(0), Direction.Forward, { ...options, adapt: Adapt.EachFrame });

    expect(lost).toBe(false);
    expect(Math.abs(samples[29].x - centreAt(29).x) * W).toBeLessThan(1.5);
  });

  it('reports the match quality of every sample', () => {
    const { samples } = trackFrom(frames(3), 0, centreAt(0), Direction.Forward, options);

    expect(samples[0].score).toBeCloseTo(1, 2);
    expect(samples[2].score).toBeGreaterThan(0.9);
  });
});
