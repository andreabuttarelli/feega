import { describe, expect, it } from 'vitest';
import { MAX_SNAP_HEIGHT, THUMB_WIDTH, scaleOf } from './canvas-capture';

describe('scaleOf', () => {
  it('shrinks a desktop page to the thumbnail width', () => {
    expect(scaleOf(1440) * 1440).toBeCloseTo(THUMB_WIDTH);
  });

  it('never enlarges a narrow page', () => {
    expect(scaleOf(390)).toBe(1);
  });

  it('keeps the tallest picture under the canvas limit of the browser', () => {
    expect(MAX_SNAP_HEIGHT * scaleOf(390)).toBeLessThan(16384);
  });
});
