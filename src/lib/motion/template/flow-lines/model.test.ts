import { describe, expect, it } from 'vitest';
import { FLOW_MODEL } from './model';

type Word = { y: number; opacity: number };
type Frame = { orbit: [number, number]; phase: number; words: Word[]; veil: number };
type Look = { strands: number; octave: number; frequency: number };
type Seed = { x: number; y: number; offset: number };
type Span = { tail: number; head: number; alpha: number };
type Model = {
  flowFrame: (p: object, t: number, length: number) => Frame;
  flowLook: (p: object) => Look;
  strandSeeds: (count: number) => Seed[];
  strandSpan: (life: number) => Span;
};

const model = new Function(`${FLOW_MODEL}; return { flowFrame, flowLook, strandSeeds, strandSpan };`)() as Model;

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

    expect(thick.strands).toBeGreaterThan(thin.strands);
    expect(thin.strands).toBeGreaterThanOrEqual(10000);
    expect(thick.strands).toBeLessThanOrEqual(60000);
    expect(wild.octave).toBeGreaterThan(calm.octave);
    expect(wild.frequency).toBeGreaterThan(calm.frequency);
    expect(model.flowLook({ ...PARAMS, density: 9 })).toEqual(thick);
    expect(model.flowLook({ ...PARAMS, turbulence: -3 })).toEqual(calm);
  });

  it('seeds the same strands every time, a round mass that thins out towards a feathered edge', () => {
    const seeds = model.strandSeeds(20000);
    const radii = seeds.map((s) => Math.hypot(s.x, s.y));
    const inner = radii.filter((r) => r < 0.5).length / (Math.PI * 0.25);
    const outer = radii.filter((r) => r >= 0.5 && r < 1).length / (Math.PI * 0.75);

    expect(model.strandSeeds(20000)).toEqual(seeds);
    expect(seeds.every((s) => s.offset >= 0 && s.offset < 1)).toBe(true);
    expect(Math.max(...radii)).toBeLessThan(1.25);
    expect(radii.filter((r) => r > 1).length).toBeGreaterThan(0);
    expect(inner).toBeGreaterThan(outer * 1.5);
  });

  it('staggers the strands, so they are born and die at different moments', () => {
    const offsets = model.strandSeeds(10000).map((s) => s.offset);
    const tenths = Array.from({ length: 10 }, (_, i) => offsets.filter((o) => Math.floor(o * 10) === i).length);

    tenths.forEach((n) => expect(n).toBeGreaterThan(800));
  });

  it('grows a strand from its head, holds it, then retracts its tail, invisible at both ends of its life', () => {
    const lives = Array.from({ length: 101 }, (_, i) => i / 100);
    const spans = lives.map((l) => model.strandSpan(l));

    expect(spans[0].alpha).toBeCloseTo(0, 9);
    expect(spans[100].alpha).toBeCloseTo(0, 9);
    expect(spans[0].head).toBe(spans[0].tail);
    expect(model.strandSpan(0.5)).toMatchObject({ tail: 0, head: 1 });
    spans.slice(1).forEach((s, i) => {
      expect(s.head).toBeGreaterThanOrEqual(spans[i].head);
      expect(s.tail).toBeGreaterThanOrEqual(spans[i].tail);
      expect(s.tail).toBeLessThanOrEqual(s.head);
    });
    expect(spans.find((s) => s.tail > 0 && s.tail < 1)?.alpha).toBeGreaterThan(0);
  });
});
