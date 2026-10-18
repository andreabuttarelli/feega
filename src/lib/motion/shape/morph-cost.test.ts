import { expect, it } from 'vitest';
import { ellipseOutline, starOutline, type Pt } from './geometry';
import { MORPH_POINTS, morphBetween, resample } from './morph';

const FRAMES = 120;
const ROUNDS = 5;
const MIN_SPEEDUP = 2;

const rotate = (ring: readonly Pt[], shift: number): Pt[] => ring.map((_, i) => ring[(i + shift) % ring.length]);
const cost = (a: readonly Pt[], b: readonly Pt[]) => a.reduce((s, p, i) => s + (p[0] - b[i][0]) ** 2 + (p[1] - b[i][1]) ** 2, 0);

function copyingAlign(from: Pt[], to: Pt[]): Pt[] {
  let best = to;
  let lowest = Infinity;
  for (const ring of [to, [...to].reverse()]) {
    for (let shift = 0; shift < ring.length; shift++) {
      const candidate = rotate(ring, shift);
      const c = cost(from, candidate);
      if (c < lowest) {
        lowest = c;
        best = candidate;
      }
    }
  }
  return best;
}

const fastest = (work: () => void) =>
  Math.min(
    ...Array.from({ length: ROUNDS }, () => {
      const began = performance.now();
      work();
      return performance.now() - began;
    })
  );

it('allineare due anelli costa meno della metà che copiarli a ogni rotazione, sulla stessa macchina', () => {
  const star = starOutline(5, 0.5, 0);
  const circle = ellipseOutline();
  const from = resample(star[0], MORPH_POINTS);
  const to = resample(circle[0], MORPH_POINTS);

  const ours = fastest(() => {
    for (let f = 0; f < FRAMES; f++) {
      morphBetween(star, circle, f / FRAMES, 0);
    }
  });
  const copying = fastest(() => {
    for (let f = 0; f < FRAMES; f++) {
      copyingAlign(from, to);
    }
  });

  expect(copying / ours).toBeGreaterThan(MIN_SPEEDUP);
});
