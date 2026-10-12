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
  it('bends every page onto its own shell, all inside the wire', () => {
    const pages = model.pageLayout(PARAMS);

    expect(pages).toHaveLength(22);
    pages.forEach((page) => {
      GRID.forEach((u) => GRID.forEach((v) => expect(Math.hypot(...model.pagePoint(page, u, v))).toBeCloseTo(page.r, 9)));
      expect(page.r).toBeLessThan(1);
    });
  });

  it('stacks the pages on levels from the core to the wire, so some pass in front of others', () => {
    const radii = model.pageLayout(PARAMS).map((p) => p.r);

    expect(Math.min(...radii)).toBeLessThan(0.6);
    expect(Math.max(...radii)).toBeGreaterThan(0.85);
    expect(radii.filter((r) => r < 0.7).length).toBeGreaterThan(radii.length / 4);
    expect(radii.filter((r) => r > 0.7).length).toBeGreaterThan(radii.length / 4);
  });

  it('never lets two pages on the same level touch, at any page count', () => {
    const angle = (a: number[], b: number[]) => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))));
    const reach = (page: Page) => Math.max(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => angle(model.pagePoint(page, 0.5, 0.5), model.pagePoint(page, u, v))));

    [6, 13, 22, 32, 40].forEach((count) => {
      [0.5, 1, 1.6].forEach((pageSize) => {
        const pages = model.pageLayout({ ...PARAMS, pages: count, pageSize });
        pages.forEach((a, i) => pages.slice(i + 1).filter((b) => b.r === a.r).forEach((b) => {
          const gap = angle(model.pagePoint(a, 0.5, 0.5), model.pagePoint(b, 0.5, 0.5)) - reach(a) - reach(b);
          expect(gap).toBeGreaterThan(0.06);
        }));
      });
    });
  });

  it('spreads the pages evenly over a few levels, with no dense inner ball', () => {
    [6, 22, 32, 40].forEach((count) => {
      const radii = model.pageLayout({ ...PARAMS, pages: count }).map((p) => p.r);
      const levels = [...new Set(radii)];
      const counts = levels.map((r) => radii.filter((x) => x === r).length);

      expect(levels.length).toBe(3);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(Math.min(...radii)).toBeGreaterThan(0.45);
    });
  });

  it('offsets the levels, so no page sits right behind another', () => {
    const pages = model.pageLayout({ ...PARAMS, pages: 32 });
    const dir = (p: Page) => model.pagePoint(p, 0.5, 0.5).map((x) => x / p.r);
    const angle = (a: number[], b: number[]) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));

    pages.forEach((a, i) => pages.slice(i + 1).filter((b) => b.r !== a.r).forEach((b) => expect(angle(dir(a), dir(b))).toBeGreaterThan(0.2)));
  });

  it('keeps inner pages readable: a deeper page spans a wider angle', () => {
    const pages = model.pageLayout(PARAMS);
    const inner = pages.filter((p) => p.r < 0.6);
    const outer = pages.filter((p) => p.r > 0.8);
    const mean = (list: Page[]) => list.reduce((s, p) => s + p.w * p.h, 0) / list.length;

    expect(mean(inner)).toBeGreaterThan(mean(outer));
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

  it('covers the globe from pole to pole', () => {
    const pages = model.pageLayout(PARAMS);
    const lats = pages.map((p) => p.lat);

    expect(Math.max(...lats)).toBeGreaterThan(0.7);
    expect(Math.min(...lats)).toBeLessThan(-0.7);
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
