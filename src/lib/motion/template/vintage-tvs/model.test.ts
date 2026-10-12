import { describe, expect, it } from 'vitest';
import { TVS_MODEL } from './model';

type Rect = { x: number; y: number; w: number; h: number };
type Tv = Rect & { screen: Rect; antenna: boolean };
type Layout = { tvs: Tv[]; width: number; height: number; hero: number };
type Screen = { sx: number; sy: number; flash: number; power: number; channel: number; noise: number; card: boolean };
type Word = { y: number; opacity: number };
type Frame = { scale: number; fx: number; fy: number; fit: number; screens: Screen[]; words: Word[] };
type Model = {
  tvLayout: (p: object) => Layout;
  tvFrame: (layout: Layout, p: object, t: number, length: number, width: number, height: number) => Frame;
};

const model = new Function(`${TVS_MODEL}; return { tvLayout, tvFrame };`)() as Model;

const PARAMS = { title: 'tune in', count: 7, wallSize: 0.84, onAt: 0.1, onStagger: 0.28, onSeconds: 0.9, firstSwitch: 4.2, channelSeconds: 2.4, pushAt: 6.2, pushSeconds: 1.4, leave: true };
const LENGTH = 13;
const FPS = 60;
const W = 1080;
const H = 1920;
const times = (from = 0, until = LENGTH) => Array.from({ length: Math.round((until - from) * FPS) + 1 }, (_, i) => from + i / FPS);
const layout = (p: object = PARAMS) => model.tvLayout(p);
const frame = (t: number, p: object = PARAMS) => model.tvFrame(layout(p), p, t, LENGTH, W, H);
const overlap = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-6 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-6;

describe('the vintage tvs model', () => {
  it('keeps between four and seven sets, none overlapping, each screen inside its cabinet', () => {
    expect(layout({ ...PARAMS, count: 2 }).tvs).toHaveLength(4);
    expect(layout({ ...PARAMS, count: 12 }).tvs).toHaveLength(7);
    const { tvs } = layout();
    tvs.forEach((a, i) => tvs.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    tvs.forEach((tv) => {
      expect(tv.screen.x).toBeGreaterThan(tv.x);
      expect(tv.screen.y).toBeGreaterThan(tv.y);
      expect(tv.screen.x + tv.screen.w).toBeLessThan(tv.x + tv.w);
      expect(tv.screen.y + tv.screen.h).toBeLessThan(tv.y + tv.h);
    });
  });

  it('sizes the sets differently', () => {
    const widths = new Set(layout().tvs.map((tv) => tv.w.toFixed(2)));

    expect(widths.size).toBeGreaterThanOrEqual(5);
  });

  it('starts and ends dark: every screen off on the first and last frame', () => {
    [frame(0), frame(LENGTH)].forEach((f) => f.screens.forEach((s) => expect(s.sx).toBe(0)));
  });

  it('powers the screens on one by one, a line first, then the full picture', () => {
    const onAt = layout().tvs.map((_, i) => times(0, 4).find((t) => frame(t).screens[i].sy > 0.99)!);
    const lineAt = layout().tvs.map((_, i) => times(0, 4).find((t) => frame(t).screens[i].sx > 0.99)!);

    expect(new Set(onAt.map((t) => t.toFixed(2))).size).toBe(onAt.length);
    lineAt.forEach((t, i) => expect(t).toBeLessThan(onAt[i]));
    lineAt.forEach((t, i) => expect(frame(t).screens[i].sy).toBeLessThan(0.05));
  });

  it('switches channel behind full static, never with the new picture showing early', () => {
    const switched = times(3, 6).filter((t, k, all) => k > 0 && frame(t).screens[1].channel !== frame(all[k - 1]).screens[1].channel);

    expect(switched).toHaveLength(1);
    expect(frame(switched[0]).screens[1].noise).toBeGreaterThan(0.95);
    expect(frame(3).screens[1].noise).toBe(0);
  });

  it('pushes into the hero set until its screen covers the frame, holding the title there', () => {
    const l = layout();
    const f = frame(9);
    const screen = l.tvs[l.hero].screen;

    expect(f.scale * f.fit * screen.w).toBeGreaterThanOrEqual(W);
    expect(f.scale * f.fit * screen.h).toBeGreaterThanOrEqual(H);
    expect(f.screens[l.hero].card).toBe(true);
    expect(f.words.every((w) => w.opacity > 0.99)).toBe(true);
    expect(frame(5).words.every((w) => w.opacity === 0)).toBe(true);
  });

  it('only zooms forward during the push and only back during the pull', () => {
    const push = times(6, 8).map((t) => frame(t).scale);
    const pull = times(11, LENGTH).map((t) => frame(t).scale);

    push.slice(1).forEach((s, i) => expect(s).toBeGreaterThanOrEqual(push[i] - 1e-9));
    pull.slice(1).forEach((s, i) => expect(s).toBeLessThanOrEqual(pull[i] + 1e-9));
  });

  it('closes the loop: the camera rests where it started', () => {
    const first = frame(0);
    const last = frame(LENGTH);

    expect(last.scale).toBeCloseTo(first.scale, 6);
    expect(last.fx).toBeCloseTo(first.fx, 6);
    expect(last.fy).toBeCloseTo(first.fy, 6);
  });

  it('keeps the title on when the loop is off', () => {
    const f = frame(LENGTH, { ...PARAMS, leave: false });

    expect(f.screens[layout().hero].card).toBe(true);
    expect(f.screens[layout().hero].sy).toBe(1);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.4, 2, 4.4, 7, 12.2];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });
});
