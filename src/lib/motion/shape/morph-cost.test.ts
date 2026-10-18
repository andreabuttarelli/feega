import { expect, it } from 'vitest';
import { ellipseOutline, starOutline } from './geometry';
import { morphBetween } from './morph';

const FRAMES = 240;
const FRAME_BUDGET_MS = 0.2;

it('un morph tra due forme chiuse costa meno di due decimi di millisecondo a frame', () => {
  const star = starOutline(5, 0.5, 0);
  const circle = ellipseOutline();
  morphBetween(star, circle, 0.5, 0);
  const began = performance.now();
  for (let f = 0; f < FRAMES; f++) {
    morphBetween(star, circle, f / FRAMES, 0);
  }
  expect((performance.now() - began) / FRAMES).toBeLessThan(FRAME_BUDGET_MS);
});
