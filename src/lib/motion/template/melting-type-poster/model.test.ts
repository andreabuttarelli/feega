import { describe, expect, it } from 'vitest';
import { MELT_MODEL } from './model';

type Page = { x: number; y: number; w: number; h: number };
type Grains = { count: number; x0: Float32Array; y0: Float32Array; a: Uint8Array; release: Float32Array; yr: Float32Array };
type Model = {
  pageBox: (width: number, height: number, margin: number) => Page;
  sandGrains: (alpha: Uint8Array, w: number, h: number, p: object, length: number) => Grains;
  grainAt: (g: Grains, i: number, t: number) => [number, number];
};

const model = new Function(`${MELT_MODEL}; return { pageBox, sandGrains, grainAt };`)() as Model;

const PARAMS = { strength: 1, meltAt: 0.6, spread: 3, gravity: 1.6 };
const LENGTH = 10;
const FPS = 60;
const W = 120;
const H = 160;
const PAGE_ASPECT = 3 / 4;

const inkedPage = () => {
  const alpha = new Uint8Array(W * H);
  const ink = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        alpha[y * W + x] = (x * 7 + y * 3) % 5 === 0 ? 0 : 200 + ((x + y) % 50);
      }
    }
  };
  ink(10, 12, 100, 40);
  ink(10, 60, 50, 110);
  ink(60, 60, 110, 110);
  ink(10, 130, 70, 136);
  return alpha;
};

const grains = (p = PARAMS) => model.sandGrains(inkedPage(), W, H, p, LENGTH);
const settled = 5;
const all = (g: Grains) => Array.from({ length: g.count }, (_, i) => i);

describe('the sand type model', () => {
  it.each([
    [1920, 1080],
    [1080, 1920],
    [1080, 1350]
  ])('fits a 3:4 page inside a %ix%i frame, centred', (width, height) => {
    const page = model.pageBox(width, height, 0.06);

    expect(page.w / page.h).toBeCloseTo(PAGE_ASPECT, 5);
    expect(page.x * 2 + page.w).toBeCloseTo(width, 5);
    expect(page.y * 2 + page.h).toBeCloseTo(height, 5);
  });

  it('makes one grain per inked pixel, so the page at rest is the text itself', () => {
    const alpha = inkedPage();
    const g = grains();

    expect(g.count).toBe(alpha.filter((a) => a > 0).length);
    all(g).forEach((i) => expect(alpha[g.y0[i] * W + g.x0[i]]).toBe(g.a[i]));
  });

  it('is crisp at both ends of the loop: every grain sits on its own pixel', () => {
    const g = grains();

    all(g).forEach((i) => {
      expect(model.grainAt(g, i, 0)).toEqual([g.x0[i], g.y0[i]]);
      expect(model.grainAt(g, i, LENGTH)).toEqual([g.x0[i], g.y0[i]]);
    });
  });

  it('turns the whole page to sand: mid-loop every grain has fallen out of the page, no heap', () => {
    const g = grains();

    all(g).forEach((i) => expect(model.grainAt(g, i, settled)[1]).toBeGreaterThanOrEqual(H));
  });

  it('falls straight down: a grain never leaves its column', () => {
    const g = grains();
    const times = Array.from({ length: LENGTH * 20 }, (_, k) => k / 20);

    all(g).filter((i) => i % 13 === 0).forEach((i) => times.forEach((t) => expect(model.grainAt(g, i, t)[0]).toBe(g.x0[i])));
  });

  it('disintegrates from the top down: the title goes before the footer', () => {
    const g = grains();
    const mean = (ids: number[]) => ids.reduce((s, i) => s + g.release[i], 0) / ids.length;

    expect(mean(all(g).filter((i) => g.y0[i] < 40))).toBeLessThan(mean(all(g).filter((i) => g.y0[i] >= 130)));
  });

  it('gives the same grains for the same page: noise is hashed, not random', () => {
    expect(grains()).toEqual(grains());
  });

  it('never jumps between two frames at 60 fps', () => {
    const g = grains();
    const times = Array.from({ length: LENGTH * FPS }, (_, k) => (k + 1) / FPS);
    const step = (i: number) =>
      Math.max(...times.map((t) => {
        const [x, y] = model.grainAt(g, i, t);
        const [px, py] = model.grainAt(g, i, t - 1 / FPS);
        return Math.hypot(x - px, y - py);
      }));

    all(g).filter((i) => i % 37 === 0).forEach((i) => expect(step(i)).toBeLessThan(H * 0.06));
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const g = grains();
    const at = [0.3, 2.5, 5.1, 8.8];
    const forward = at.map((t) => model.grainAt(g, 17, t));
    const backward = [...at].reverse().map((t) => model.grainAt(g, 17, t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('stays still with zero strength', () => {
    const g = grains({ ...PARAMS, strength: 0 });

    all(g).forEach((i) => expect(model.grainAt(g, i, settled)).toEqual([g.x0[i], g.y0[i]]));
  });
});
