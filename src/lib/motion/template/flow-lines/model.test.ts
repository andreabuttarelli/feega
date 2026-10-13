import { describe, expect, it } from 'vitest';
import { FLOW_MODEL } from './model';

type Word = { y: number; opacity: number };
type Frame = { orbit: [number, number]; phase: number; words: Word[]; veil: number };
type Look = { sparsity: number; octave: number; frequency: number };
type Model = {
  flowFrame: (p: object, t: number, length: number) => Frame;
  flowLook: (p: object) => Look;
};

const model = new Function(`${FLOW_MODEL}; return { flowFrame, flowLook };`)() as Model;

const PARAMS = { title: 'go with the flow', density: 0.6, turbulence: 0.5, speed: 2, titleAt: 5, titleSeconds: 3, titleDim: 0.75 };
const LENGTH = 10;
const FPS = 60;
const times = Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frame = (t: number, p: object = PARAMS) => model.flowFrame(p, t, LENGTH);

describe('the flow lines model', () => {
  it('ends the loop exactly where it starts', () => {
    const first = frame(0);
    const last = frame(LENGTH);

    expect(last.orbit[0]).toBeCloseTo(first.orbit[0], 9);
    expect(last.orbit[1]).toBeCloseTo(first.orbit[1], 9);
    expect(Math.cos(2 * Math.PI * last.phase)).toBeCloseTo(Math.cos(2 * Math.PI * first.phase), 9);
    expect(last.veil).toBeCloseTo(first.veil, 9);
  });

  it('walks the field once round a circle, so it never jumps', () => {
    const steps = times.slice(1).map((t, i) => Math.hypot(frame(t).orbit[0] - frame(times[i]).orbit[0], frame(t).orbit[1] - frame(times[i]).orbit[1]));

    times.forEach((t) => expect(Math.hypot(...frame(t).orbit)).toBeCloseTo(1, 9));
    expect(Math.max(...steps)).toBeLessThan(0.02);
  });

  it('flows along the lines a whole number of times per loop, faster with speed', () => {
    const slow = frame(LENGTH, { ...PARAMS, speed: 1 }).phase - frame(0, { ...PARAMS, speed: 1 }).phase;
    const fast = frame(LENGTH, { ...PARAMS, speed: 3.4 }).phase - frame(0, { ...PARAMS, speed: 3.4 }).phase;

    expect(slow).toBe(1);
    expect(fast).toBe(3);
  });

  it('gives the title its own beat: the field dims under it and comes back after', () => {
    const before = frame(2);
    const during = frame(6.5);
    const after = frame(9.5);

    expect(before.words.every((w) => w.opacity === 0)).toBe(true);
    expect(before.veil).toBe(0);
    expect(during.words).toHaveLength(4);
    expect(during.words.every((w) => w.opacity > 0.99)).toBe(true);
    expect(during.veil).toBeCloseTo(PARAMS.titleDim, 2);
    expect(after.words.every((w) => w.opacity === 0)).toBe(true);
    expect(after.veil).toBeLessThan(0.01);
  });

  it('without a title nothing dims the field', () => {
    times.forEach((t) => {
      expect(frame(t, { ...PARAMS, title: '  ' }).veil).toBe(0);
      expect(frame(t, { ...PARAMS, title: '' }).words).toEqual([]);
    });
  });

  it('never moves the veil by a visible step between two frames', () => {
    const jumps = times.slice(1).map((t, i) => Math.abs(frame(t).veil - frame(times[i]).veil));

    expect(Math.max(...jumps)).toBeLessThan(0.05);
  });

  it('turns density into denser strands, and turbulence into finer whirls', () => {
    const thin = model.flowLook({ ...PARAMS, density: 0 });
    const thick = model.flowLook({ ...PARAMS, density: 1 });
    const calm = model.flowLook({ ...PARAMS, turbulence: 0 });
    const wild = model.flowLook({ ...PARAMS, turbulence: 1 });

    expect(thick.sparsity).toBeLessThan(thin.sparsity);
    expect(wild.octave).toBeGreaterThan(calm.octave);
    expect(wild.frequency).toBeGreaterThan(calm.frequency);
    expect(model.flowLook({ ...PARAMS, density: 9 })).toEqual(thick);
    expect(model.flowLook({ ...PARAMS, turbulence: -3 })).toEqual(calm);
  });
});
