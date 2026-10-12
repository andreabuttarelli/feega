import { describe, expect, it } from 'vitest';
import { SCROLL_MODEL } from './model';

type Layout = { pitch: number; closeY: number; lineSize: number; box: { ax: number; ay: number }; lines: { y: number; text: string }[] };
type Look = { opacity: number; y: number; blur: number };
type Frame = { camera: number; speed: number; shift: number; streak: number; list: number; open: Look; close: Look; land: number };
type Model = {
  scrollLayout: (p: object, width: number, height: number) => Layout;
  scrollFrame: (layout: Layout, p: object, t: number, length: number, fps: number) => Frame;
};

const model = new Function(`${SCROLL_MODEL}; return { scrollLayout, scrollFrame };`)() as Model;

const PARAMS = {
  lines: 'One canvas for every idea\nVideos made from a prompt\nYour brand, on every frame\nMotion templates you can remix\nExport in every format',
  repeat: 4,
  fontSize: 12,
  lineScale: 0.5,
  lineSpacing: 1.2,
  gap: 0.4,
  titleAt: 0,
  holdSeconds: 1,
  readSpeed: 1.1,
  readSeconds: 3.2,
  accelSeconds: 2.4,
  accelCurve: 2.5,
  brakeSeconds: 1.6,
  motionBlur: 0.6,
  titleBlur: 0.12,
  leave: true
};
const LENGTH = 12;
const FPS = 30;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const run = (p: object = PARAMS, [w, h]: readonly number[] = ASPECTS.landscape) => {
  const layout = model.scrollLayout(p, w, h);
  return { layout, frames: times().map((t) => model.scrollFrame(layout, p, t, LENGTH, FPS)) };
};

describe('the feature scroll model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const layout = model.scrollLayout(PARAMS, 1920, 1080);
    const at = [0.3, 4, 7.1, 9.9, 11.5];
    const forward = at.map((t) => model.scrollFrame(layout, PARAMS, t, LENGTH, FPS));
    const backward = [...at].reverse().map((t) => model.scrollFrame(layout, PARAMS, t, LENGTH, FPS)).reverse();

    expect(backward).toEqual(forward);
  });

  it('only ever scrolls down: the camera never moves back', () => {
    const { frames } = run();

    frames.slice(1).forEach((f, i) => expect(f.camera).toBeGreaterThanOrEqual(frames[i].camera - 1e-9));
  });

  it('reads first: a stretch at reading speed, then accelerates far past it', () => {
    const { frames } = run();
    const reading = frames.filter((f) => Math.abs(f.speed - PARAMS.readSpeed) < 1e-9);
    const peak = Math.max(...frames.map((f) => f.speed));

    expect(reading.length / FPS).toBeGreaterThan(PARAMS.readSeconds * 0.9);
    expect(peak).toBeGreaterThan(PARAMS.readSpeed * 8);
  });

  it('changes speed smoothly: no per-frame displacement jumps', () => {
    const { frames } = run();
    const steps = frames.slice(1).map((f, i) => f.camera - frames[i].camera);
    const jumps = steps.slice(1).map((s, i) => Math.abs(s - steps[i]));

    expect(Math.max(...jumps)).toBeLessThan(Math.max(...steps) * 0.15);
  });

  for (const [name, size] of Object.entries(ASPECTS)) {
    it(`lands the closing title dead centre and holds it in ${name}`, () => {
      const { layout, frames } = run(PARAMS, size);
      const landed = frames.filter((_, i) => i / FPS >= frames[0].land && i / FPS <= LENGTH - 0.8);

      expect(landed.length / FPS).toBeGreaterThan(1);
      landed.forEach((f) => {
        expect(f.camera).toBeCloseTo(layout.closeY, 9);
        expect(f.speed).toBe(0);
        expect(f.close.opacity).toBe(1);
      });
    });

    it(`has every line gone up and out of the frame once landed in ${name}`, () => {
      const { layout } = run(PARAMS, size);
      const half = layout.lineSize / 2;

      layout.lines.forEach((line) => expect(line.y - layout.closeY + half).toBeLessThan(-layout.box.ay));
    });
  }

  it('repeats the list as many times as asked', () => {
    const { layout } = run({ ...PARAMS, repeat: 3 });

    expect(layout.lines).toHaveLength(15);
    expect(layout.lines[5].text).toBe(layout.lines[0].text);
  });

  it('closes the loop: the first and last frames are both the empty background', () => {
    const { frames } = run();
    const [first, last] = [frames[0], frames[frames.length - 1]];

    expect(first.open.opacity).toBe(0);
    expect(first.list).toBe(0);
    expect(last.close.opacity).toBeCloseTo(0, 6);
  });

  it('without loop, the closing title stays on the last frame', () => {
    const { frames } = run({ ...PARAMS, leave: false });

    expect(frames[frames.length - 1].close.opacity).toBe(1);
  });

  it('streaks only while moving, in proportion to the blur amount', () => {
    const { frames } = run();
    const fastest = frames.reduce((a, b) => (b.speed > a.speed ? b : a));

    expect(frames[0].streak).toBe(0);
    expect(fastest.streak).toBeCloseTo(fastest.shift * PARAMS.motionBlur, 9);
    expect(run({ ...PARAMS, motionBlur: 0 }).frames.every((f) => f.streak === 0)).toBe(true);
  });

  it('shows the opening title within the first frames', () => {
    const { frames } = run();

    expect(frames[Math.round(0.3 * FPS)].open.opacity).toBeGreaterThan(0.5);
  });
});
