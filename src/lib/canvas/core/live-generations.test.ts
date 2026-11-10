import { describe, expect, it } from 'vitest';
import { liveGenerations } from './live-generations';

describe('liveGenerations', () => {
  it('lands a build even when newer ones were asked while it ran', () => {
    const gens = liveGenerations();
    const first = gens.ask('f');
    gens.ask('f');
    gens.ask('f');

    expect(gens.land('f', first)).toBe(true);
  });

  it('never lands a build older than the one shown', () => {
    const gens = liveGenerations();
    const first = gens.ask('f');
    const second = gens.ask('f');

    expect(gens.land('f', second)).toBe(true);
    expect(gens.land('f', first)).toBe(false);
  });

  it('keeps frames apart', () => {
    const gens = liveGenerations();
    const a = gens.ask('a');
    gens.ask('b');
    gens.ask('b');

    expect(gens.land('a', a)).toBe(true);
    expect(gens.land('b', 1)).toBe(true);
  });

  it('a frame playing slower than its builds still advances', () => {
    const gens = liveGenerations();
    const TICKS = 30;
    const BUILD_TICKS = 3;
    const asked: number[] = [];
    let landed = 0;
    for (let t = 0; t < TICKS; t++) {
      asked.push(gens.ask('f'));
      const done = asked[t - BUILD_TICKS];
      if (done !== undefined && gens.land('f', done)) {
        landed++;
      }
    }

    expect(landed).toBe(TICKS - BUILD_TICKS);
  });
});
