import { describe, expect, it } from 'vitest';
import { CAPTURE_DELAY_MAX_MS, DELAY_BUDGET_MS, delayFor, delayOf, NO_DELAY } from './capture-wait';

describe('delayOf', () => {
  it('senza richiesta non aspetta', () => {
    expect(delayOf(undefined)).toEqual(NO_DELAY);
    expect(delayOf({ ms: 'tanto' })).toEqual(NO_DELAY);
  });

  it('scarta i valori negativi o non interi e taglia al massimo', () => {
    expect(delayOf({ ms: -5 }).ms).toBe(0);
    expect(delayOf({ ms: 1.5 }).ms).toBe(0);
    expect(delayOf({ ms: 10 ** 9 }).ms).toBe(CAPTURE_DELAY_MAX_MS);
  });

  it('tiene le attese per rotta valide', () => {
    expect(delayOf({ ms: 100, routes: { '/a': 2_000, '/b': -1, '/c': 'x' } })).toEqual({ ms: 100, routes: { '/a': 2_000 } });
  });
});

describe('delayFor', () => {
  it('la rotta batte il valore generale, anche con zero', () => {
    const delay = { ms: 3_000, routes: { '/slow': 5_000, '/fast': 0 } };

    expect(delayFor(delay, '/slow', 3)).toBe(5_000);
    expect(delayFor(delay, '/fast', 3)).toBe(0);
    expect(delayFor(delay, '/other', 3)).toBe(3_000);
  });

  it('con molte pagine l\'attesa totale resta nel budget', () => {
    const pages = 20;

    const each = delayFor({ ms: CAPTURE_DELAY_MAX_MS, routes: {} }, '/', pages);

    expect(each * pages).toBeLessThanOrEqual(DELAY_BUDGET_MS);
    expect(each).toBeGreaterThan(0);
  });
});
