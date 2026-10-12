import { describe, expect, it } from 'vitest';
import { PHONE_MODEL } from './model';

type Point = { x: number; y: number };
type Layout = { axis: string; fit: number; phoneW: number; phoneH: number; gap: number; cx: number; riseFrom: number };
type Word = { rise: number; opacity: number };
type Frame = { arrived: number; phone: Point & { tilt: number }; left: Point; right: Point; words: Word[]; times: { riseAt: number; titleAt: number; dropAt: number } };
type Measure = { leftW: number; rightW: number; space: number; frameW: number; frameH: number };
type Model = {
  phoneLayout: (p: object, m: Measure) => Layout;
  phoneFrame: (layout: Layout, p: object, t: number, length: number, words: number) => Frame;
};

const model = new Function(`${PHONE_MODEL}; return { phoneLayout, phoneFrame };`)() as Model;

const PARAMS = {
  phoneHeight: 7.4,
  gap: 0.4,
  stack: 'auto',
  riseAt: 0.2,
  riseSeconds: 1.6,
  titleDelay: 0,
  tilt: true,
  tiltDegrees: 14,
  dropSeconds: 1.2,
  leave: true
};
const MEASURE: Measure = { leftW: 3.2, rightW: 3.0, space: 0.25, frameW: 19.8, frameH: 11.1 };
const TALL: Measure = { ...MEASURE, frameW: 11.1, frameH: 19.8 };
const LENGTH = 8;
const FPS = 30;
const WORDS = 4;

const run = (p: object = PARAMS, m: Measure = MEASURE) => {
  const layout = model.phoneLayout(p, m);
  const frames = Array.from({ length: LENGTH * FPS + 1 }, (_, i) => model.phoneFrame(layout, p, i / FPS, LENGTH, WORDS));
  return { layout, frames };
};

describe('the phone split model', () => {
  it('starts with the phone entirely below the frame', () => {
    const { layout, frames } = run();

    expect(frames[0].phone.y - layout.phoneH / 2).toBeGreaterThanOrEqual(MEASURE.frameH / layout.fit / 2);
  });

  it('rises monotonically into the centre, without overshoot', () => {
    const { frames } = run();
    const rising = frames.slice(0, frames.findIndex((f) => f.arrived === 1) + 1);

    rising.slice(1).forEach((f, i) => expect(f.phone.y).toBeLessThanOrEqual(rising[i].phone.y));
    frames.forEach((f) => expect(f.phone.y).toBeGreaterThanOrEqual(0));
    expect(frames.find((f) => f.arrived === 1)?.phone.y).toBe(0);
  });

  it('settles the tilt to upright as it arrives, only when asked', () => {
    const { frames } = run();

    expect(frames[0].phone.tilt).toBe(PARAMS.tiltDegrees);
    expect(frames.find((f) => f.arrived === 1)?.phone.tilt).toBe(0);
    expect(run({ ...PARAMS, tilt: false }).frames.every((f) => f.phone.tilt === 0)).toBe(true);
  });

  it('keeps the halves hugging the phone edges on every frame', () => {
    const { layout, frames } = run();

    frames.forEach((f) => {
      expect(f.right.x - (f.phone.x + layout.phoneW / 2)).toBeCloseTo(layout.gap, 9);
      expect(f.phone.x - layout.phoneW / 2 - f.left.x).toBeCloseTo(layout.gap, 9);
    });
  });

  it('keeps the whole line centred: the phone sits where the halves balance', () => {
    const { layout } = run();

    expect(layout.cx).toBeCloseTo((MEASURE.leftW - MEASURE.rightW) / 2, 9);
  });

  it('shows no word before the phone has arrived', () => {
    const { frames } = run();

    const arrival = frames.findIndex((f) => f.arrived >= 0.9);

    frames.slice(0, arrival).forEach((f) => f.words.forEach((w) => expect(w.opacity).toBe(0)));
    expect(frames.find((f) => f.words[0].opacity > 0)?.arrived).toBeGreaterThanOrEqual(0.9);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const layout = model.phoneLayout(PARAMS, MEASURE);
    const at = [0.4, 2.1, 3.3, 6.2, 7.9];
    const forward = at.map((t) => model.phoneFrame(layout, PARAMS, t, LENGTH, WORDS));
    const backward = [...at].reverse().map((t) => model.phoneFrame(layout, PARAMS, t, LENGTH, WORDS)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: words gone and phone below the frame on the first and last frames', () => {
    const { frames } = run();
    const [first, last] = [frames[0], frames[frames.length - 1]];

    expect(last.phone).toEqual(first.phone);
    first.words.forEach((w) => expect(w.opacity).toBe(0));
    last.words.forEach((w) => expect(w.opacity).toBeCloseTo(0, 9));
  });

  it('lets the words leave before the phone descends', () => {
    const { frames } = run();
    const descending = frames.find((f, i) => i > 0 && f.phone.y > frames[i - 1].phone.y);

    descending?.words.forEach((w) => expect(w.opacity).toBeLessThan(0.5));
  });

  it('without loop, holds the phone and headline on the last frame', () => {
    const { frames } = run({ ...PARAMS, leave: false });
    const last = frames[frames.length - 1];

    expect(last.phone.y).toBe(0);
    last.words.forEach((w) => expect(w.opacity).toBe(1));
  });

  it('stacks the halves above and below the phone in a portrait frame', () => {
    const { layout, frames } = run(PARAMS, TALL);
    const open = frames.find((f) => f.arrived === 1);

    expect(layout.axis).toBe('column');
    expect(open?.right.y).toBeCloseTo(layout.phoneH / 2 + layout.gap + 0.5, 9);
    expect(open?.left.y).toBeCloseTo(-(layout.phoneH / 2 + layout.gap + 0.5), 9);
    expect((layout.phoneH + 2 * layout.gap + 2) * layout.fit).toBeLessThanOrEqual(TALL.frameH * 0.88 + 1e-9);
  });

  it('scales the row to fit the frame', () => {
    const wide = { ...MEASURE, leftW: 9, rightW: 9 };
    const layout = model.phoneLayout(PARAMS, wide);

    expect((wide.leftW + wide.rightW + layout.phoneW + 2 * layout.gap) * layout.fit).toBeLessThanOrEqual(wide.frameW * 0.88 + 1e-9);
    expect(layout.phoneH * layout.fit).toBeLessThanOrEqual(wide.frameH * 0.88 + 1e-9);
  });
});
