import { describe, expect, it } from 'vitest';
import { RIBBON_MODEL } from './model';

type Word = { y: number; opacity: number };
type Frame = { phase: number; fold: number; sway: number; yaw: number; pitch: number; words: Word[]; veil: number };
type Model = {
  ribbonFrame: (p: object, t: number, length: number) => Frame;
  particleCount: (density: number) => number;
  gradientStops: (p: object) => number[][];
  particleSeeds: (n: number) => Float32Array;
  MAX_PARTICLES: number;
};

const model = new Function(`${RIBBON_MODEL}; return { ribbonFrame, particleCount, gradientStops, particleSeeds, MAX_PARTICLES };`)() as Model;

const PARAMS = { title: 'made of motion', density: 600, speed: 1, titleAt: 3.6, titleHold: 2.6, colorA: '#0b2f8a', colorB: '#14b4d6', colorC: '#8cc63f', colorD: '#f6d30a' };
const LENGTH = 10;
const FPS = 60;
const times = Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frame = (t: number, p: object = PARAMS) => model.ribbonFrame(p, t, LENGTH);
const shape = (f: Frame) => [Math.sin(f.phase), Math.cos(f.phase), f.fold, f.sway, f.yaw, f.pitch];

describe('the particle ribbon model', () => {
  it('closes the loop: the sheet, the camera and the title end where they began', () => {
    shape(frame(LENGTH)).forEach((x, i) => expect(x).toBeCloseTo(shape(frame(0))[i], 9));
    expect(frame(LENGTH).veil).toBeCloseTo(frame(0).veil, 9);
    frame(LENGTH).words.forEach((w, i) => expect(w.opacity).toBeCloseTo(frame(0).words[i].opacity, 9));
  });

  it('keeps moving without jumps at 60fps, speed in whole cycles per loop', () => {
    [1, 2.4].forEach((speed) => {
      const path = times.map((t) => shape(frame(t, { ...PARAMS, speed })));
      const steps = path.slice(1).map((s, k) => Math.max(...s.map((x, i) => Math.abs(x - path[k][i]))));
      expect(Math.max(...steps)).toBeLessThan(0.03 * Math.round(speed));
      expect(Math.min(...steps)).toBeGreaterThan(0);
    });
    expect(frame(LENGTH, { ...PARAMS, speed: 2.4 }).phase).toBeCloseTo(4 * Math.PI, 9);
    expect(frame(LENGTH, { ...PARAMS, speed: 0 }).phase).toBeCloseTo(2 * Math.PI, 9);
  });

  it('gives the title its own beat: the sheet veils, the words enter, then leave before the loop ends', () => {
    expect(frame(1).veil).toBe(0);
    expect(frame(1).words.every((w) => w.opacity === 0)).toBe(true);
    expect(frame(PARAMS.titleAt + 1.6).veil).toBeGreaterThan(0.5);
    expect(frame(PARAMS.titleAt + 1.6).words.every((w) => w.opacity > 0.99)).toBe(true);
    expect(frame(LENGTH - 0.5).veil).toBe(0);
    expect(frame(LENGTH - 0.5).words.every((w) => w.opacity === 0)).toBe(true);
  });

  it('without a title there is no veil at all', () => {
    times.forEach((t) => expect(frame(t, { ...PARAMS, title: '  ' }).veil).toBe(0));
  });

  it('turns grain density into a particle count inside the GPU budget', () => {
    expect(model.particleCount(600)).toBe(600_000);
    expect(model.particleCount(5)).toBe(100_000);
    expect(model.particleCount(1e9)).toBe(model.MAX_PARTICLES);
    expect(model.MAX_PARTICLES).toBeLessThanOrEqual(1_000_000);
  });

  it('reads the gradient as four sRGB stops, falling back on a broken colour', () => {
    const stops = model.gradientStops({ ...PARAMS, colorB: 'not a colour' });

    expect(stops).toHaveLength(4);
    expect(stops[0]).toEqual([11 / 255, 47 / 255, 138 / 255]);
    expect(stops[3]).toEqual([246 / 255, 211 / 255, 10 / 255]);
    stops[1].forEach((c) => expect(Number.isFinite(c)).toBe(true));
  });

  it('seeds every particle the same way on every run, spread evenly on the sheet', () => {
    const a = model.particleSeeds(20_000);
    const b = model.particleSeeds(20_000);
    const us = Array.from({ length: 20_000 }, (_, i) => a[i * 3]);
    const mean = us.reduce((s, u) => s + u, 0) / us.length;

    expect(a).toEqual(b);
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...a)).toBeLessThan(1);
    expect(mean).toBeCloseTo(0.5, 1);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.2, 4.4, 9.9, 3];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });
});
