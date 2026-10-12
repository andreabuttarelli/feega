import { describe, expect, it } from 'vitest';
import { MELT_MODEL } from './model';

type Column = { activity: number; delay: number; reach: number; split: number };
type Melt = { drop: number; fade: number };
type Page = { x: number; y: number; w: number; h: number };
type Model = {
  pageBox: (width: number, height: number, margin: number) => Page;
  meltColumns: (count: number, p: object) => Column[];
  meltAt: (column: Column, p: object, t: number, length: number) => Melt;
};

const model = new Function(`${MELT_MODEL}; return { pageBox, meltColumns, meltAt };`)() as Model;

const PARAMS = { strength: 1, reach: 0.55, meltAt: 1.2, holdFor: 2, spread: 1.4 };
const LENGTH = 10;
const FPS = 60;
const COLUMNS = 240;
const PAGE_ASPECT = 3 / 4;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);

describe('the melting type model', () => {
  it.each([
    [1920, 1080],
    [1080, 1920],
    [1080, 1080]
  ])('fits a 3:4 page inside a %ix%i frame, centred', (width, height) => {
    const page = model.pageBox(width, height, 0.06);

    expect(page.w / page.h).toBeCloseTo(PAGE_ASPECT, 5);
    expect(page.x).toBeGreaterThanOrEqual(0);
    expect(page.y).toBeGreaterThanOrEqual(0);
    expect(page.x * 2 + page.w).toBeCloseTo(width, 5);
    expect(page.y * 2 + page.h).toBeCloseTo(height, 5);
  });

  it('gives the same columns for the same count: per-column noise is seeded, not random', () => {
    expect(model.meltColumns(COLUMNS, PARAMS)).toEqual(model.meltColumns(COLUMNS, PARAMS));
  });

  it('melts in clusters: some columns drip, some stay still', () => {
    const active = model.meltColumns(COLUMNS, PARAMS).map((c) => c.activity > 0.05);
    const runs = active.filter((on, i) => on !== active[i - 1]).length;

    expect(active.filter(Boolean).length / COLUMNS).toBeGreaterThan(0.25);
    expect(active.filter(Boolean).length / COLUMNS).toBeLessThan(0.8);
    expect(runs).toBeGreaterThan(6);
    expect(runs).toBeLessThan(COLUMNS / 4);
  });

  it('is crisp at both ends of the loop, so the first and last frames match', () => {
    const columns = model.meltColumns(COLUMNS, PARAMS);

    columns.forEach((c) => {
      expect(model.meltAt(c, PARAMS, 0, LENGTH)).toEqual({ drop: 0, fade: 0 });
      expect(model.meltAt(c, PARAMS, LENGTH, LENGTH)).toEqual({ drop: 0, fade: 0 });
    });
  });

  it('drips down and then reassembles: every active column reaches its full drop mid-loop', () => {
    const columns = model.meltColumns(COLUMNS, PARAMS).filter((c) => c.activity > 0.5);
    const peaks = columns.map((c) => Math.max(...times().map((t) => model.meltAt(c, PARAMS, t, LENGTH).drop)));

    peaks.forEach((peak, i) => expect(peak).toBeCloseTo(PARAMS.reach * columns[i].reach * columns[i].activity * PARAMS.strength, 3));
  });

  it('never jumps between two frames at 60 fps', () => {
    const columns = model.meltColumns(COLUMNS, PARAMS);
    const step = (c: Column) => Math.max(...times().slice(1).map((t) => Math.abs(model.meltAt(c, PARAMS, t, LENGTH).drop - model.meltAt(c, PARAMS, t - 1 / FPS, LENGTH).drop)));

    columns.forEach((c) => expect(step(c)).toBeLessThan(0.03));
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const column = model.meltColumns(COLUMNS, PARAMS)[17];
    const at = [0.3, 2.5, 5.1, 8.8];
    const forward = at.map((t) => model.meltAt(column, PARAMS, t, LENGTH));
    const backward = [...at].reverse().map((t) => model.meltAt(column, PARAMS, t, LENGTH)).reverse();

    expect(backward).toEqual(forward);
  });

  it('stays still with zero strength', () => {
    const still = { ...PARAMS, strength: 0 };

    model.meltColumns(COLUMNS, still).forEach((c) => times().forEach((t) => expect(model.meltAt(c, still, t, LENGTH).drop).toBe(0)));
  });
});
