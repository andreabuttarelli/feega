import { describe, expect, it } from 'vitest';
import { missingInk, popShare, type Shot } from './screen-pops';

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

describe('missing ink', () => {
  const paper = 230;

  it('is the share of the rest picture ink a sample shows as paper or white', () => {
    const v = { x: 0, y: 0, zoom: 1 };
    const rest = shot(v, square(v));
    const blank = shot(v, () => 255);

    expect(missingInk(rest, blank, paper)).toBe(1);
    expect(missingInk(rest, rest, paper)).toBe(0);
  });

  it('follows the camera between the rest picture and the sample', () => {
    const r = { x: 0, y: 0, zoom: 1 };
    const s = { x: -10, y: -10, zoom: 2 };

    expect(missingInk(shot(r, square(r)), shot(s, square(s)), paper)).toBeLessThan(0.1);
  });
});

describe('missing ink across zooms', () => {
  it('does not judge a sample zoomed far from the rest picture', () => {
    const r = { x: 0, y: 0, zoom: 4 };
    const s = { x: 0, y: 0, zoom: 1 };

    expect(missingInk(shot(r, square(r)), shot(s, () => 255), 230)).toBeNull();
  });
});

describe('missing ink when blurred', () => {
  it('counts a blurred copy of the rest picture as shown, not missing', () => {
    const v = { x: 0, y: 0, zoom: 1 };
    const blurred = shot(v, (x, y) => (square(v)(x, y) === 0 ? 150 : 245));

    expect(missingInk(shot(v, square(v)), blurred, 230)).toBe(0);
  });
});
