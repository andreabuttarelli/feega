import { describe, expect, it } from 'vitest';
import { vanishes, type Gray } from './flicker';

const W = 180;
const H = 112;
const PAPER = 235;
const INK = 20;

type Box = { x: number; y: number; w: number; h: number };

function drawn(boxes: Box[], zoom = 1): Gray {
  const data = new Uint8Array(W * H).fill(PAPER);
  const [cx, cy] = [W / 2, H / 2];
  for (const b of boxes) {
    const [x0, y0] = [Math.round(cx + (b.x - cx) * zoom), Math.round(cy + (b.y - cy) * zoom)];
    const [x1, y1] = [Math.round(cx + (b.x + b.w - cx) * zoom), Math.round(cy + (b.y + b.h - cy) * zoom)];
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      data.fill(INK, y * W + Math.max(0, x0), y * W + Math.min(W, x1));
    }
  }
  return { width: W, height: H, data };
}

const scene = [
  { x: 20, y: 20, w: 30, h: 70 },
  { x: 80, y: 10, w: 20, h: 60 },
  { x: 130, y: 15, w: 14, h: 80 }
];

describe('vanishes', () => {
  it('flags a frame that drops to the paper for one frame while the rest stays', () => {
    expect(vanishes(drawn(scene), drawn(scene.slice(0, 2)), drawn(scene))).toBe(true);
  });

  it('flags a vanish in the middle of a zoom', () => {
    expect(vanishes(drawn(scene, 1), drawn(scene.slice(0, 2), 1.1), drawn(scene, 1.2))).toBe(true);
  });

  it('does not flag page edges that move with an uneven zoom step', () => {
    expect(vanishes(drawn(scene, 1), drawn(scene, 1.35), drawn(scene, 1.4))).toBe(false);
  });

  it('does not flag a still scene', () => {
    expect(vanishes(drawn(scene), drawn(scene), drawn(scene))).toBe(false);
  });
});
