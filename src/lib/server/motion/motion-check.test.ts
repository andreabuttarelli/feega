import { describe, expect, it } from 'vitest';
import { Jolt } from '$lib/motion/smoothness';
import { checkTimes, motionCheck } from './motion-check';

const grid = (level: number) => new Uint8Array(16).fill(level);

describe('checkTimes', () => {
  it('asks for consecutive frames from the given second', () => {
    expect(checkTimes({ from: 1, count: 4, fps: 30, end: 10 })).toEqual([1, 1.0333, 1.0667, 1.1]);
  });

  it('pulls the window back so it ends inside the video', () => {
    expect(checkTimes({ from: 9.9, count: 4, fps: 10, end: 10 })).toEqual([9.6, 9.7, 9.8, 9.9]);
  });
});

describe('motionCheck', () => {
  it('names a lone jump in a steady move, at the time of the frame that jumps', () => {
    const lumas = [0, 1, 2, 3, 4, 5, 15, 16, 17, 18, 19, 20].map(grid);
    const times = lumas.map((_, i) => i / 10);

    const check = motionCheck(lumas, times);

    expect(check.jolts).toEqual([{ time: 0.6, kind: Jolt.Pop }]);
    expect(check.note).toContain('0.6');
  });

  it('reports frames that stop changing as frozen, so a stuck shader shows up', () => {
    const lumas = [0, 2, 4, 4, 4, 4, 4, 4, 4, 6].map(grid);
    const times = lumas.map((_, i) => i / 10);

    expect(motionCheck(lumas, times).frozen).toEqual([{ from: 0.2, to: 0.8 }]);
  });

  it('a smooth eased move is clean', () => {
    const lumas = [0, 0.5, 1.5, 3, 4.5, 5.5, 6, 6.2].map((v) => grid(Math.round(v * 4)));

    expect(motionCheck(lumas, lumas.map((_, i) => i / 30))).toMatchObject({ jolts: [], frozen: [] });
  });
});
