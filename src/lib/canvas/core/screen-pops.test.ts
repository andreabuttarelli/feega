import { describe, expect, it } from 'vitest';
import { popShare, type Shot } from './screen-pops';

const W = 40;
const H = 30;

function shot(view: Shot['view'], paint: (x: number, y: number) => number): Shot {
  const gray = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      gray[y * W + x] = paint(x, y);
    }
  }
  return { width: W, height: H, gray, view };
}

const square = (view: Shot['view']) => (x: number, y: number) => {
  const wx = (x - view.x) / view.zoom;
  const wy = (y - view.y) / view.zoom;
  return wx >= 5 && wx < 15 && wy >= 5 && wy < 15 ? 0 : 255;
};

describe('pop share', () => {
  it('is zero when the next frame is the previous one moved by the camera', () => {
    const a = { x: 0, y: 0, zoom: 1 };
    const b = { x: 7, y: 3, zoom: 1 };

    expect(popShare(shot(a, square(a)), shot(b, square(b)))).toBe(0);
  });

  it('is zero across a zoom', () => {
    const a = { x: 0, y: 0, zoom: 1 };
    const b = { x: -5, y: -5, zoom: 1.5 };

    expect(popShare(shot(a, square(a)), shot(b, square(b)))).toBeLessThan(0.02);
  });

  it('counts what changed that the camera does not explain', () => {
    const a = { x: 0, y: 0, zoom: 1 };
    const b = { x: 7, y: 3, zoom: 1 };

    expect(popShare(shot(a, square(a)), shot(b, () => 255))).toBeGreaterThan(0.05);
  });
});
