import { describe, expect, it } from 'vitest';
import { boxOf } from './layout';

describe('relative layout', () => {
  it('the same props place the box proportionally in every format', () => {
    const p = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };

    expect(boxOf(p, { width: 1920, height: 1080 })).toEqual({ left: 480, top: 270, width: 960, height: 540 });
    expect(boxOf(p, { width: 1080, height: 1920 })).toEqual({ left: 270, top: 480, width: 540, height: 960 });
  });
});
