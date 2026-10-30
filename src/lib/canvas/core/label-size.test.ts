import { describe, expect, it } from 'vitest';
import { LABEL_HIDE_FRAME_PX, LABEL_MIN_FACTOR, LABEL_SCREEN_PX, labelScale, labelScreenPx, labelShown, labelZoomStep } from './label-size';

describe('labelScreenPx', () => {
  it('stays at the normal size at 100% and above', () => {
    expect(labelScreenPx(1)).toBe(LABEL_SCREEN_PX);
    expect(labelScreenPx(4)).toBe(LABEL_SCREEN_PX);
  });

  it('shrinks only gently below 100%', () => {
    expect(labelScreenPx(0.75)).toBeGreaterThan(LABEL_SCREEN_PX * 0.9);
    expect(labelScreenPx(0.75)).toBeLessThan(LABEL_SCREEN_PX);
    expect(labelScreenPx(0.5)).toBeCloseTo(LABEL_SCREEN_PX * 0.5 ** 0.3, 5);
  });

  it('never goes below the floor, however far out', () => {
    expect(labelScreenPx(0.05)).toBeCloseTo(LABEL_SCREEN_PX * LABEL_MIN_FACTOR, 5);
    expect(labelScreenPx(0.001)).toBeGreaterThanOrEqual(9);
  });
});

describe('labelZoomStep', () => {
  it('is 1 from 100% up, so zooming in never redraws labels', () => {
    expect(labelZoomStep(1)).toBe(1);
    expect(labelZoomStep(3.7)).toBe(1);
  });

  it('holds one value across a small zoom move', () => {
    expect(labelZoomStep(0.2)).toBe(labelZoomStep(0.2001));
  });

  it('stays within a tenth of the real zoom', () => {
    for (const z of [0.05, 0.1, 0.25, 0.5, 0.8]) {
      expect(Math.abs(labelZoomStep(z) / z - 1)).toBeLessThan(0.1);
    }
  });
});

describe('labelScale', () => {
  it('is 1 at 100%', () => {
    expect(labelScale(1)).toBe(1);
  });

  it('makes the world size land on the screen size', () => {
    for (const z of [0.05, 0.1, 0.25, 0.5]) {
      expect(LABEL_SCREEN_PX * labelScale(z) * z).toBeCloseTo(labelScreenPx(z), 5);
    }
  });
});

describe('labelShown', () => {
  it('hides the label of a frame narrower than the threshold on screen', () => {
    expect(labelShown(0.1, 200)).toBe(false);
    expect(labelShown(0.1, (LABEL_HIDE_FRAME_PX - 1) / 0.1)).toBe(false);
  });

  it('shows it from the threshold up', () => {
    expect(labelShown(0.1, LABEL_HIDE_FRAME_PX / 0.1)).toBe(true);
    expect(labelShown(1, 300)).toBe(true);
  });
});
