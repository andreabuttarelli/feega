import { describe, expect, it } from 'vitest';
import { Ease } from '@feega/motion-core/motion/design';
import { motionKeyframes, type CapturedMotion } from './captured-motion';

const STAGE = { fps: 30, durationInFrames: 90, width: 1000, height: 500 };

const marquee: CapturedMotion = { durationMs: 1000, delayMs: 0, loop: true, samples: [{ at: 0, dx: 0, dy: 0, rotate: 0, scale: 1, opacity: 1 }, { at: 1, dx: -200, dy: 0, rotate: 0, scale: 1, opacity: 1 }] };

describe('a CSS animation read from a page, as keyframes', () => {
  it('a loop repeats over the whole timeline, sliding by the distance it slid on the page in doc units, linearly', () => {
    const keys = motionKeyframes(marquee, { x: 0, y: 0 }, 1, STAGE);

    expect(keys.x.map((k) => [k.frame, Number(Number(k.value).toFixed(3))])).toEqual([
      [0, 0],
      [29, -0.193],
      [30, 0],
      [59, -0.193],
      [60, 0],
      [89, -0.193]
    ]);
    expect(keys.x.every((k) => k.ease === Ease.Linear)).toBe(true);
    expect(keys.y).toBeUndefined();
  });

  it('a move that plays once lands where the page left it and holds', () => {
    const fadeIn: CapturedMotion = { durationMs: 500, delayMs: 200, loop: false, samples: [{ at: 0, dx: 0, dy: 20, rotate: 0, scale: 1, opacity: 0 }, { at: 1, dx: 0, dy: 0, rotate: 0, scale: 1, opacity: 1 }] };
    const keys = motionKeyframes(fadeIn, { x: 0, y: 0 }, 2, STAGE);

    expect(keys.opacity.map((k) => [k.frame, k.value])).toEqual([
      [6, 0],
      [21, 1]
    ]);
    expect(keys.y.map((k) => [k.frame, k.value])).toEqual([
      [6, 0.08],
      [21, 0]
    ]);
  });
});
