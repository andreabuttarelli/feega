import { describe, expect, it } from 'vitest';
import { STEPS_MODEL } from './model';

type Fade = { opacity: number; rise: number };
type Step = Fade & { current: number };
type Frame = { heading: Fade; line: number; steps: Step[]; working: number };
type Model = {
  parseSteps: (raw: string) => { label: string; detail: string }[];
  stepsFrame: (p: object, t: number, length: number, count: number) => Frame;
  shimmer: (p: object, t: number, letters: number) => number[];
};

const model = new Function(`${STEPS_MODEL}; return { parseSteps, stepsFrame, shimmer };`)() as Model;

const PARAMS = { delay: 0.4, pace: 1.6 };
const LENGTH = 12;
const FPS = 30;
const COUNT = 3;
const LETTERS = 7;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const visible = (f: Frame) => Math.max(f.heading.opacity, f.line, f.working, ...f.steps.map((s) => s.opacity));

describe('the steps list model', () => {
  it('reads one step per line or semicolon, label before the dash, detail after', () => {
    expect(model.parseSteps('Processing - a jacket; Generating\nImage - one - two')).toEqual([
      { label: 'Processing', detail: 'a jacket' },
      { label: 'Generating', detail: '' },
      { label: 'Image', detail: 'one - two' }
    ]);
    expect(model.parseSteps('  ;\n')).toEqual([]);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 4.1, 9.7, 11.9];
    const frame = (t: number) => [model.stepsFrame(PARAMS, t, LENGTH, COUNT), model.shimmer(PARAMS, t, LETTERS)];
    const forward = at.map(frame);
    const backward = [...at].reverse().map(frame).reverse();

    expect(backward).toEqual(forward);
  });

  it('loops: nothing is visible at the first and last frame', () => {
    expect(visible(model.stepsFrame(PARAMS, 0, LENGTH, COUNT))).toBeLessThan(1e-3);
    expect(visible(model.stepsFrame(PARAMS, LENGTH, LENGTH, COUNT))).toBeLessThan(1e-3);
  });

  it('brings the steps in one by one, each moving while it fades, never backwards', () => {
    const entering = times().filter((t) => t < 8).map((t) => model.stepsFrame(PARAMS, t, LENGTH, COUNT));
    for (let s = 0; s < COUNT; s++) {
      entering.slice(1).forEach((f, i) => {
        expect(f.steps[s].opacity).toBeGreaterThanOrEqual(entering[i].steps[s].opacity - 1e-12);
        expect(f.steps[s].rise).toBeLessThanOrEqual(entering[i].steps[s].rise + 1e-12);
      });
    }
    const mid = model.stepsFrame(PARAMS, 0.4 + 1 + 1.6 + 0.3, LENGTH, COUNT);

    expect(mid.steps[0].opacity).toBe(1);
    expect(mid.steps[1].opacity).toBeGreaterThan(0);
    expect(mid.steps[1].rise).toBeGreaterThan(0);
    expect(mid.steps[2].opacity).toBe(0);
  });

  it('highlights only the newest step, handing over smoothly', () => {
    const frames = times().map((t) => model.stepsFrame(PARAMS, t, LENGTH, COUNT));
    const settled = model.stepsFrame(PARAMS, 9, LENGTH, COUNT);

    expect(settled.steps.map((s) => s.current)).toEqual([0, 0, 1]);
    for (let s = 0; s < COUNT; s++) {
      const jumps = frames.slice(1).map((f, i) => Math.abs(f.steps[s].current - frames[i].steps[s].current));
      expect(Math.max(...jumps)).toBeLessThan(0.12);
    }
  });

  it('grows the line once, before the first step lands', () => {
    const lines = times().filter((t) => t < 6).map((t) => model.stepsFrame(PARAMS, t, LENGTH, COUNT).line);

    lines.slice(1).forEach((l, i) => expect(l).toBeGreaterThanOrEqual(lines[i] - 1e-12));
    expect(model.stepsFrame(PARAMS, PARAMS.delay + PARAMS.pace + 1.1, LENGTH, COUNT).line).toBe(1);
  });

  it('sweeps a shimmer across the letters with no jump between frames', () => {
    const frames = times().map((t) => model.shimmer(PARAMS, t, LETTERS));
    const steps = frames.slice(1).flatMap((f, i) => f.map((v, k) => Math.abs(v - frames[i][k])));

    expect(Math.max(...steps)).toBeLessThan(0.2);
    expect(frames.flat().every((v) => v >= 0 && v <= 1)).toBe(true);
    const peaks = [4.6, 4.9, 5.2].map((t) => model.shimmer(PARAMS, t, LETTERS)).map((f) => f.indexOf(Math.max(...f)));
    expect(peaks[1]).toBeGreaterThan(peaks[0]);
    expect(peaks[2]).toBeGreaterThan(peaks[1]);
  });
});
