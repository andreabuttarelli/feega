import { describe, expect, it } from 'vitest';
import { quadStyle } from './quad-box';

const turned = (degrees: number): [number, number][] => {
  const r = (degrees * Math.PI) / 180;
  return [
    [0, 0],
    [100, 0],
    [100, 50],
    [0, 50]
  ].map(([x, y]) => [10 + x * Math.cos(r) - y * Math.sin(r), 20 + x * Math.sin(r) + y * Math.cos(r)]);
};

describe('quadStyle', () => {
  it('places an upright box with no turn', () => {
    expect(quadStyle(turned(0))).toBe('left:10px;top:20px;width:100px;height:50px');
  });

  it('turns about its first corner for a rotated quad', () => {
    expect(quadStyle(turned(30))).toBe('left:10px;top:20px;width:100px;height:50px;transform:rotate(30deg)');
  });
});
