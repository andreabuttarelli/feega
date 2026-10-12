import { describe, expect, it } from 'vitest';
import { MOCKUP_MODEL } from './model';

type Rect = { x0: number; y0: number; x1: number; y1: number };
type Layout = { box: { ax: number; ay: number }; monitor: Rect; watermark: Rect };
type Pose = { lift: number; yaw: number; pitch: number; scale: number; opacity: number };
type Frame = { pose: Pose; sway: number; markShift: number; typed: number; reveal: number; hover: number; scroll: number; bars: number; cursor: number };
type Model = {
  mockupLayout: (p: object, width: number, height: number, textEm: number) => Layout;
  covered: (layout: Layout) => number;
  mockupFrame: (p: object, t: number, length: number) => Frame;
};

const model = new Function(`${MOCKUP_MODEL}; return { mockupLayout, covered, mockupFrame };`)() as Model;

const PARAMS = {
  headline: 'The AI workspace\nfor product teams',
  monitorSize: 0.5,
  monitorY: -0.03,
  watermarkSize: 44,
  watermarkY: -0.17,
  tiltYaw: -16,
  tiltPitch: 7,
  drift: 1,
  enterAt: 0,
  enterSeconds: 1.8,
  typeSpeed: 24,
  scroll: true,
  scrollSeconds: 1.8,
  leave: true,
  exitSeconds: 1.4
};
const LENGTH = 12;
const FPS = 30;
const TEXT_EM = 4.5;

const frames = (p: object = PARAMS) => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => model.mockupFrame(p, i / FPS, LENGTH));
const enterEnd = PARAMS.enterAt + PARAMS.enterSeconds;

describe('the saas monitor model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.4, 3.3, 6.1, 9.8, 11.7];
    const forward = at.map((t) => model.mockupFrame(PARAMS, t, LENGTH));
    const backward = [...at].reverse().map((t) => model.mockupFrame(PARAMS, t, LENGTH)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: the last frame matches the first', () => {
    const [first, last] = [model.mockupFrame(PARAMS, 0, LENGTH), model.mockupFrame(PARAMS, LENGTH, LENGTH)];

    expect(first.pose.opacity).toBe(0);
    expect(last.pose.opacity).toBeCloseTo(0, 6);
    expect(last.pose.lift).toBeCloseTo(first.pose.lift, 6);
    expect(last.markShift).toBeCloseTo(first.markShift, 6);
    expect(last.sway).toBeCloseTo(first.sway, 6);
  });

  it('without loop the monitor stays on the last frame', () => {
    const last = model.mockupFrame({ ...PARAMS, leave: false }, LENGTH, LENGTH);

    expect(last.pose.opacity).toBe(1);
    expect(last.pose.lift).toBe(0);
  });

  it('enters monotonically: it rises into its pose and never passes it', () => {
    const entering = frames().filter((_, i) => i / FPS <= enterEnd);

    entering.forEach((f) => expect(f.pose.lift).toBeGreaterThanOrEqual(0));
    entering.slice(1).forEach((f, i) => {
      expect(f.pose.lift).toBeLessThanOrEqual(entering[i].pose.lift + 1e-12);
      expect(f.pose.scale).toBeGreaterThanOrEqual(entering[i].pose.scale - 1e-12);
      expect(f.pose.opacity).toBeGreaterThanOrEqual(entering[i].pose.opacity - 1e-12);
    });
    expect(entering[entering.length - 1].pose.lift).toBe(0);
  });

  it('sways once and slowly: the drift turns back at most one time', () => {
    const sway = frames().map((f) => f.sway);
    const steps = sway.slice(1).map((s, i) => s - sway[i]);
    const turns = steps.slice(1).filter((s, i) => Math.sign(s) !== 0 && Math.sign(steps[i]) !== 0 && Math.sign(s) !== Math.sign(steps[i]));

    expect(turns.length).toBeLessThanOrEqual(1);
    expect(Math.max(...steps.map(Math.abs))).toBeLessThan(0.02);
  });

  it('types the headline, then reveals, hovers the call to action and scrolls, in that order', () => {
    const all = frames();
    const first = (test: (f: Frame) => boolean) => all.findIndex(test);

    const typedAt = first((f) => f.typed === 1);
    const revealAt = first((f) => f.reveal > 0);
    const hoverAt = first((f) => f.hover > 0);
    const scrollAt = first((f) => f.scroll > 0);

    expect(typedAt).toBeGreaterThan(0);
    expect(revealAt).toBeGreaterThanOrEqual(typedAt);
    expect(hoverAt).toBeGreaterThan(revealAt);
    expect(scrollAt).toBeGreaterThan(hoverAt);
    expect(all.find((f) => f.scroll === 1)).toBeDefined();
  });

  it('types, reveals and scrolls forward only', () => {
    const all = frames().filter((_, i) => i / FPS < LENGTH - PARAMS.exitSeconds);

    all.slice(1).forEach((f, i) => {
      expect(f.typed).toBeGreaterThanOrEqual(all[i].typed);
      expect(f.reveal).toBeGreaterThanOrEqual(all[i].reveal);
      expect(f.scroll).toBeGreaterThanOrEqual(all[i].scroll);
    });
  });

  it('stays on the hero when scroll is off', () => {
    expect(frames({ ...PARAMS, scroll: false }).every((f) => f.scroll === 0)).toBe(true);
  });

  it.each([[1920, 1080], [1080, 1920], [1080, 1080]])('places the watermark behind the monitor, partly hidden and wider than the frame at %ix%i', (w, h) => {
    const layout = model.mockupLayout(PARAMS, w, h, TEXT_EM);
    const share = model.covered(layout);

    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.85);
    expect(layout.watermark.x1 - layout.watermark.x0).toBeGreaterThan(2 * layout.box.ax);
    expect(layout.watermark.x1 - layout.watermark.x0).toBeLessThan(4 * layout.box.ax);
  });

  it('keeps the monitor inside the frame at rest', () => {
    const { monitor, box } = model.mockupLayout(PARAMS, 1920, 1080, TEXT_EM);

    expect(monitor.x0).toBeGreaterThan(-box.ax);
    expect(monitor.x1).toBeLessThan(box.ax);
    expect(monitor.y0).toBeGreaterThan(-box.ay);
  });
});
