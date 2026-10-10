import { describe, expect, it } from 'vitest';
import { Jolt, frameDiffs, motionJolts } from './smoothness';

const ramp = (n: number, peak: number) => Array.from({ length: n }, (_, i) => peak * Math.sin((Math.PI * i) / (n - 1)));

describe('motionJolts', () => {
  it('an eased move, accelerating then settling, is smooth', () => {
    expect(motionJolts([0, 0, ...ramp(15, 3), 0, 0])).toEqual([]);
  });

  it('a lone spike in an otherwise steady move is a pop', () => {
    const steady = Array(12).fill(0.5);
    steady[6] = 4;

    expect(motionJolts(steady)).toEqual([{ frame: 6, kind: Jolt.Pop, value: 4, around: 0.5 }]);
  });

  it('a move that stops dead at speed is a stop, not an ease out', () => {
    expect(motionJolts([0, 0.5, 2, 5, 9, 9.5, 0.2, 0.2, 0.2]).map((j) => [j.frame, j.kind])).toEqual([[6, Jolt.Stop]]);
  });

  it('frames that alternate between two states every frame are a flicker', () => {
    expect(motionJolts([1.5, 0, 1.5, 0, 1.5, 0, 1.5, 0]).map((j) => j.kind)).toContain(Jolt.Flicker);
  });

  it('a hard cut the edit asked for is not a jolt', () => {
    expect(motionJolts([0.2, 0.2, 0.2, 60, 0.2, 0.2, 0.2], { cuts: [3] })).toEqual([]);
  });

  it('a hold, nothing moving, is smooth', () => {
    expect(motionJolts(Array(20).fill(0))).toEqual([]);
  });
});

describe('frameDiffs', () => {
  it('is the mean absolute change between consecutive frames', () => {
    const frames = [new Uint8Array([0, 0]), new Uint8Array([10, 30]), new Uint8Array([10, 30])];

    expect(frameDiffs(frames)).toEqual([20, 0]);
  });
});
