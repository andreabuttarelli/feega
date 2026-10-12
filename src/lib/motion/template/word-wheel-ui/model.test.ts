import { describe, expect, it } from 'vitest';
import { WHEEL_MODEL } from './model';

type Rect = { x0: number; y0: number; x1: number; y1: number };
type Layout = { axis: string; box: { ax: number; ay: number }; em: number; text: Rect; panel: Rect & { w: number; h: number } };
type Word = { offset: number; opacity: number; focus: number };
type Frame = { lead: { opacity: number; rise: number }; words: Word[]; panel: { shift: number; yaw: number; opacity: number }; glow: number };
type Measure = { leadW: number; wordW: number };
type Model = {
  wheelLayout: (p: object, width: number, height: number, m: Measure) => Layout;
  wheelFrame: (p: object, t: number, length: number, n: number) => Frame;
};

const model = new Function(`${WHEEL_MODEL}; return { wheelLayout, wheelFrame };`)() as Model;

const PARAMS = { textSize: 9, gap: 0.32, panelSize: 0.66, yaw: -24, pitch: 8, roll: -2, drift: 1, enterAt: 0, enterSeconds: 1.8, stepSeconds: 0.9, exitSeconds: 1.4, leave: true };
const LENGTH = 12;
const FPS = 30;
const WORDS = 3;
const MEASURE: Measure = { leadW: 1.9, wordW: 3.5 };
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const at = (t: number, p: object = PARAMS) => model.wheelFrame(p, t, LENGTH, WORDS);
const focused = (f: Frame) => f.words.findIndex((w) => w.focus > 0.99);

describe('the word wheel model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const picks = [0.4, 3.1, 6.6, 9.2];
    const forward = picks.map((t) => at(t));
    const backward = [...picks].reverse().map((t) => at(t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: first and last frames are the same empty frame', () => {
    const first = at(0);
    const last = at(LENGTH);

    expect(first.lead.opacity).toBeCloseTo(0, 4);
    expect(last.lead.opacity).toBeCloseTo(0, 4);
    [...first.words, ...last.words].forEach((w) => expect(w.opacity).toBeCloseTo(0, 4));
    expect(first.panel.opacity).toBeCloseTo(0, 4);
    expect(last.panel.opacity).toBeCloseTo(0, 4);
  });

  it('loops seamlessly without the exit too: the wheel turns a whole round', () => {
    const stay = { ...PARAMS, leave: false, enterSeconds: 0.0001 };
    const first = at(0.001, stay);
    const last = at(LENGTH, stay);

    first.words.forEach((w, i) => expect(w.focus).toBeCloseTo(last.words[i].focus, 3));
  });

  it('lands on every word once, in order, and comes back to the first', () => {
    const holds = times().map((t) => focused(at(t))).filter((i, k, all) => i >= 0 && i !== all[k - 1]);

    expect(holds).toEqual([0, 1, 2, 0]);
  });

  it('holds each word long enough to read it', () => {
    const runs: number[] = [];
    let run = 0;
    for (const t of times().filter((t) => t > PARAMS.enterSeconds && t < LENGTH - PARAMS.exitSeconds)) {
      run = focused(at(t)) >= 0 ? run + 1 : (run && runs.push(run), 0);
    }

    expect(Math.min(...runs) / FPS).toBeGreaterThan(1.2);
  });

  it('dims every word but the centred one', () => {
    const hold = at(3);
    const others = hold.words.filter((w) => w.focus < 0.99);

    expect(hold.words.filter((w) => w.focus > 0.99)).toHaveLength(1);
    others.forEach((w) => expect(w.focus).toBeLessThan(0.01));
  });

  it('wraps a word from top to bottom only while it is invisible', () => {
    const frames = times().map((t) => at(t));
    frames.slice(1).forEach((f, k) => {
      f.words.forEach((w, i) => {
        const before = frames[k].words[i];
        if (Math.abs(w.offset - before.offset) > 0.5) {
          expect(Math.max(w.opacity, before.opacity)).toBeLessThan(0.01);
        }
      });
    });
  });

  it('turns the wheel without a jolt', () => {
    const frames = times().map((t) => at(t).words[1].offset);
    const steps = frames.slice(1).map((o, k) => o - frames[k]).filter((s) => Math.abs(s) < 0.5);
    const jolts = steps.slice(1).map((s, k) => Math.abs(s - steps[k]));

    expect(Math.max(...jolts)).toBeLessThan(Math.max(...steps.map(Math.abs)) * 0.5);
  });

  it('turns one way only: words always travel upward', () => {
    const frames = times().map((t) => at(t).words[0].offset);
    frames.slice(1).forEach((o, k) => {
      const step = o - frames[k];
      expect(step > 0.5 || step <= 1e-9).toBe(true);
    });
  });

  it('slides the panel in from the right and out again, never moving back', () => {
    const shifts = times().map((t) => at(t).panel.shift);
    const entering = shifts.slice(0, PARAMS.enterSeconds * FPS + 1);
    const leaving = shifts.slice((LENGTH - PARAMS.exitSeconds) * FPS);

    expect(shifts[0]).toBeGreaterThan(0.5);
    entering.slice(1).forEach((s, k) => expect(s).toBeLessThanOrEqual(entering[k] + 1e-12));
    leaving.slice(1).forEach((s, k) => expect(s).toBeGreaterThanOrEqual(leaving[k] - 1e-12));
    expect(at(4).panel.shift).toBeCloseTo(0, 6);
  });

  it('brings the words in rising while they fade, the lead word first', () => {
    const frames = times().map((t) => at(t));
    const leadIn = frames.findIndex((f) => f.lead.opacity > 0.5);
    const wheelIn = frames.findIndex((f) => f.words[0].opacity > 0.5);

    expect(leadIn).toBeLessThanOrEqual(wheelIn);
    expect(frames[leadIn].lead.rise).toBeGreaterThan(0);
  });

  for (const [name, [width, height]] of Object.entries(ASPECTS)) {
    it(`keeps the words on screen and clear of the panel in ${name}`, () => {
      const layout = model.wheelLayout(PARAMS, width, height, MEASURE);
      const { text, panel, box } = layout;

      expect(text.x0, name).toBeGreaterThan(-box.ax);
      expect(text.x1, name).toBeLessThan(box.ax);
      expect(text.y0, name).toBeGreaterThan(-box.ay);
      expect(text.y1, name).toBeLessThan(box.ay);
      const apart = text.x1 <= panel.x0 || text.y1 <= panel.y0;
      expect(apart, name).toBe(true);
    });
  }

  it('lays out side by side in landscape and stacked in portrait', () => {
    expect(model.wheelLayout(PARAMS, 1920, 1080, MEASURE).axis).toBe('row');
    expect(model.wheelLayout(PARAMS, 1080, 1920, MEASURE).axis).toBe('column');
  });
});
