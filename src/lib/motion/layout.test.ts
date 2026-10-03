import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { angleAt, boxOf, moveTransform } from './layout';

describe('relative layout', () => {
  it('the same props place the box proportionally in every format', () => {
    const p = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };

    expect(boxOf(p, { width: 1920, height: 1080 })).toEqual({ left: 480, top: 270, width: 960, height: 540 });
    expect(boxOf(p, { width: 1080, height: 1920 })).toEqual({ left: 270, top: 480, width: 540, height: 960 });
  });

  it('a zoom-in starts at rest and ends enlarged', () => {
    expect(moveTransform('zoom-in', Ease.Linear, 0, 31)).toBe('scale(1)');
    expect(moveTransform('zoom-in', Ease.Linear, 30, 31)).toBe('scale(1.12)');
  });

  it('the 3D camera goes from the start angle to the end angle, plus the turntable', () => {
    const camera = { startAngle: 0, endAngle: 90, orbitSpeed: 0, easing: Ease.Linear };

    expect(angleAt(camera, 0, 31, 30)).toBe(0);
    expect(angleAt(camera, 30, 31, 30)).toBe(90);
    expect(angleAt({ ...camera, orbitSpeed: 30 }, 30, 31, 30)).toBe(120);
  });
});
