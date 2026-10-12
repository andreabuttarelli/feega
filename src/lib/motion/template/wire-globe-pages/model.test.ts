import { describe, expect, it } from 'vitest';
import { WIRE_MODEL } from './model';

type Page = { lat: number; lon: number; roll: number; w: number; h: number; r: number; slot: number };
type Frame = { yaw: number; tilt: number; pitch: number };
type Model = {
  pageLayout: (p: object) => Page[];
  pagePoint: (page: Page, u: number, v: number) => number[];
  wireFrame: (p: object, t: number, length: number) => Frame;
  facingOf: (point: number[], f: Frame) => number;
};

const model = new Function(`${WIRE_MODEL}; return { pageLayout, pagePoint, wireFrame, facingOf };`)() as Model;

const PARAMS = { pages: 22, pageSize: 1, pageAspect: 0.75, turns: 1, axisTilt: 18, sway: 6 };
const LENGTH = 12;
const FPS = 60;
const times = Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const GRID = [0, 0.5, 1];

describe('the wire globe pages model', () => {
  it('bends every page onto the sphere, just inside the wire', () => {
    const pages = model.pageLayout(PARAMS);

    expect(pages).toHaveLength(22);
    pages.forEach((page) => {
      GRID.forEach((u) => GRID.forEach((v) => expect(Math.hypot(...model.pagePoint(page, u, v))).toBeCloseTo(page.r, 9)));
      expect(page.r).toBeLessThan(1);
      expect(page.r).toBeGreaterThan(0.9);
    });
  });

  it('gives each page its own layer, so overlaps never flicker', () => {
    const radii = model.pageLayout(PARAMS).map((p) => p.r);

    expect(new Set(radii).size).toBe(radii.length);
  });

  it('keeps the page shape: width over height is the asked aspect', () => {
    const page = model.pageLayout(PARAMS)[3];
    const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const wide = dist(model.pagePoint(page, 0, 0.5), model.pagePoint(page, 1, 0.5));
    const tall = dist(model.pagePoint(page, 0.5, 0), model.pagePoint(page, 0.5, 1));

    expect(wide / tall).toBeCloseTo(page.w / page.h, 1);
    expect(page.w / page.h).toBeGreaterThan(0.6);
    expect(page.w / page.h).toBeLessThan(0.9);
  });

  it('covers the globe from pole to pole, overlapping', () => {
    const pages = model.pageLayout(PARAMS);
    const lats = pages.map((p) => p.lat);
    const area = pages.reduce((sum, p) => sum + p.w * p.h, 0);

    expect(Math.max(...lats)).toBeGreaterThan(0.7);
    expect(Math.min(...lats)).toBeLessThan(-0.7);
    expect(area).toBeGreaterThan(4 * Math.PI * 0.9);
  });

  it('is the same layout every time', () => {
    expect(model.pageLayout(PARAMS)).toEqual(model.pageLayout(PARAMS));
  });

  it('turns forward at a steady pace, never stopping or jerking', () => {
    const yaws = times.map((t) => model.wireFrame(PARAMS, t, LENGTH).yaw);
    const steps = yaws.slice(1).map((y, i) => y - yaws[i]);
    const base = (2 * Math.PI) / (LENGTH * FPS);

    steps.forEach((s) => expect(s).toBeCloseTo(base, 9));
  });

  it('sways the axis smoothly, without a jump between frames', () => {
    const pitches = times.map((t) => model.wireFrame(PARAMS, t, LENGTH).pitch);
    const steps = pitches.slice(1).map((y, i) => y - pitches[i]);

    steps.slice(1).forEach((s, i) => expect(Math.abs(s - steps[i])).toBeLessThan(1e-4));
  });

  it('closes the loop: the last frame is the first, a whole turn later', () => {
    const first = model.wireFrame(PARAMS, 0, LENGTH);
    const last = model.wireFrame(PARAMS, LENGTH, LENGTH);
    const turned = (last.yaw - first.yaw) / (2 * Math.PI);

    expect(turned).toBeCloseTo(Math.round(turned), 9);
    expect(last.pitch).toBeCloseTo(first.pitch, 9);
    expect(last.tilt).toBeCloseTo(first.tilt, 9);
  });

  it('tells the front of the globe from the back', () => {
    const f = model.wireFrame({ ...PARAMS, axisTilt: 0, sway: 0 }, 0, LENGTH);
    const front = [0, 0, 1];
    const back = [0, 0, -1];
    const yawed = (q: number[]) => [q[0] * Math.cos(-f.yaw) + q[2] * Math.sin(-f.yaw), q[1], -q[0] * Math.sin(-f.yaw) + q[2] * Math.cos(-f.yaw)];

    expect(model.facingOf(yawed(front), f)).toBeCloseTo(1, 6);
    expect(model.facingOf(yawed(back), f)).toBeCloseTo(-1, 6);
  });
});
