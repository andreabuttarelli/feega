import { describe, expect, it } from 'vitest';
import { BLUR_LINES_MODEL } from './model';

type Letter = { opacity: number; glow: number };
type Line = { at: number; scale: number };
type Frame = { letters: Letter[]; shift: number; text: number; lines: Line[]; blob: { x: number; y: number; rotate: number; scale: number } };
type Model = { blurLinesFrame: (p: object, t: number, length: number, widths: number[]) => Frame };

const model = new Function(`${BLUR_LINES_MODEL}; return { blurLinesFrame };`)() as Model;

const PARAMS = { text: 'Imagine to have all your tools', typeAt: 1, typeSeconds: 2.6, drift: 0.06, leave: true };
const LENGTH = 10;
const FPS = 30;
const WIDTHS = Array.from(PARAMS.text, (c) => (c === ' ' ? 0.25 : 0.5));
const FULL = WIDTHS.reduce((a, b) => a + b, 0);
const times = (until = LENGTH) => Array.from({ length: Math.round(until * FPS) + 1 }, (_, i) => i / FPS);
const frame = (t: number, p: object = PARAMS) => model.blurLinesFrame(p, t, LENGTH, WIDTHS);

describe('the blur gradient lines model', () => {
  it('shows nothing typed before the typing starts and the whole line after', () => {
    expect(frame(0.9).letters.every((l) => l.opacity === 0)).toBe(true);
    expect(frame(5).letters.every((l) => l.opacity > 0.999)).toBe(true);
  });

  it('types left to right: an earlier letter is never fainter than a later one', () => {
    times().forEach((t) => {
      const l = frame(t).letters;
      l.slice(1).forEach((x, i) => expect(x.opacity).toBeLessThanOrEqual(l[i].opacity + 1e-9));
    });
  });

  it('glows on the newest letters, not the old ones', () => {
    const l = frame(PARAMS.typeAt + PARAMS.typeSeconds * 0.6).letters;
    const lit = l.map((x, i) => ({ ...x, i })).filter((x) => x.opacity > 0.5);
    const newest = lit[lit.length - 1];

    expect(newest.glow).toBeGreaterThan(0.5);
    expect(lit[0].glow).toBeLessThan(0.05);
  });

  it('lets the glow settle once the line is typed', () => {
    expect(Math.max(...frame(7).letters.map((l) => l.glow))).toBeLessThan(0.02);
  });

  it('keeps the typed part centred, gliding without jumps', () => {
    const shifts = times().map((t) => frame(t).shift);
    const steps = shifts.slice(1).map((s, i) => Math.abs(s - shifts[i]));

    expect(frame(0.5).shift).toBeCloseTo(FULL / 2, 6);
    expect(frame(5).shift).toBeCloseTo(0, 6);
    steps.forEach((s) => expect(s).toBeLessThan(FULL * 0.03));
    steps.slice(1).forEach((s, i) => expect(Math.abs(s - steps[i])).toBeLessThan(FULL * 0.004));
  });

  it('draws the hairlines in, holds them, and takes them away for the loop', () => {
    expect(frame(0).lines.every((l) => l.scale === 0)).toBe(true);
    expect(frame(5).lines.every((l) => l.scale > 0.999)).toBe(true);
    expect(frame(LENGTH).lines.every((l) => l.scale < 1e-6)).toBe(true);
    frame(5).lines.forEach((l) => expect(l.at).toBeGreaterThan(0) && expect(l.at).toBeLessThan(1));
  });

  it('closes the loop: the last frame matches the first', () => {
    const first = frame(0);
    const last = frame(LENGTH);

    expect(last.blob.x).toBeCloseTo(first.blob.x, 6);
    expect(last.blob.y).toBeCloseTo(first.blob.y, 6);
    expect(last.blob.rotate).toBeCloseTo(first.blob.rotate, 6);
    expect(last.blob.scale).toBeCloseTo(first.blob.scale, 6);
    first.letters.forEach((l, i) => expect(last.letters[i].opacity * last.text).toBeCloseTo(l.opacity * first.text, 6));
  });

  it('drifts the blurred shape the whole time, never jerking', () => {
    const xs = times().map((t) => frame(t).blob.x);
    const steps = xs.slice(1).map((x, i) => x - xs[i]);

    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(PARAMS.drift);
    steps.slice(1).forEach((s, i) => expect(Math.abs(s - steps[i])).toBeLessThan(PARAMS.drift * 0.01));
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 2, 6.4, 9.8];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });
});
