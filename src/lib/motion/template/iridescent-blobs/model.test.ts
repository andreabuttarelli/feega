import { describe, expect, it } from 'vitest';
import { BLOBS_MODEL } from './model';

type Ball = { x: number; y: number; r: number };
type Word = { y: number; opacity: number };
type Frame = { blobs: Ball[]; bubbles: Ball[]; phase: number; words: Word[]; dim: number };
type Model = {
  blobsLayout: (p: object) => object;
  blobsFrame: (layout: object, p: object, t: number, length: number) => Frame;
  hexRgb: (hex: string) => [number, number, number];
};

const model = new Function(`${BLOBS_MODEL}; return { blobsLayout, blobsFrame, hexRgb };`)() as Model;

const PARAMS = { title: 'soft matter', bubbles: 0.6, speed: 1, mass: 1, seed: 3, titleAt: 3, titleSeconds: 4.5 };
const LENGTH = 12;
const FPS = 60;
const times = Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frame = (t: number, p: object = PARAMS) => model.blobsFrame(model.blobsLayout(p), p, t, LENGTH);
const balls = (f: Frame) => [...f.blobs, ...f.bubbles];

describe('the iridescent blobs model', () => {
  it('loops: the last frame is the first one', () => {
    const first = frame(0);
    const last = frame(LENGTH);

    balls(first).forEach((b, i) => {
      expect(balls(last)[i].x).toBeCloseTo(b.x, 9);
      expect(balls(last)[i].y).toBeCloseTo(b.y, 9);
      expect(balls(last)[i].r).toBeCloseTo(b.r, 9);
    });
    expect(Math.cos(last.phase)).toBeCloseTo(Math.cos(first.phase), 9);
  });

  it('is a pure function of t', () => {
    expect(frame(4.2)).toEqual(frame(4.2));
  });

  it('moves slowly and without jumps', () => {
    let worst = 0;
    for (let i = 1; i < times.length; i++) {
      const a = balls(frame(times[i - 1]));
      const b = balls(frame(times[i]));
      a.forEach((ball, k) => {
        worst = Math.max(worst, Math.hypot(ball.x - b[k].x, ball.y - b[k].y));
      });
    }

    expect(worst).toBeGreaterThan(0);
    expect(worst, 'share of the short side per frame').toBeLessThan(0.004);
  });

  it('keeps living: the mass travels a visible distance over the loop', () => {
    const start = frame(0).blobs;
    const half = frame(LENGTH / 2).blobs;
    const travel = Math.max(...start.map((b, i) => Math.hypot(b.x - half[i].x, b.y - half[i].y)));

    expect(travel).toBeGreaterThan(0.08);
  });

  it('runs faster with more speed, still looping', () => {
    const x = (t: number, speed: number) => frame(t, { ...PARAMS, speed }).blobs[0].x;
    const path = (speed: number) => times.slice(1).reduce((sum, t, i) => sum + Math.abs(x(t, speed) - x(times[i], speed)), 0);

    expect(path(2)).toBeGreaterThan(path(1) * 1.5);
    expect(x(LENGTH, 2)).toBeCloseTo(x(0, 2), 9);
  });

  it('embeds more bubbles with more density, none at zero', () => {
    expect(frame(1, { ...PARAMS, bubbles: 0 }).bubbles).toHaveLength(0);
    expect(frame(1, { ...PARAMS, bubbles: 1 }).bubbles.length).toBeGreaterThan(frame(1, { ...PARAMS, bubbles: 0.3 }).bubbles.length);
  });

  it('keeps every bubble inside the reach of a blob', () => {
    const f = frame(5);

    f.bubbles.forEach((b) => {
      const near = Math.min(...f.blobs.map((blob) => Math.hypot(b.x - blob.x, b.y - blob.y) - blob.r));
      expect(near).toBeLessThan(0.02);
    });
  });

  it('changes the arrangement with the seed', () => {
    expect(frame(1, { ...PARAMS, seed: 4 }).blobs[0].x).not.toBeCloseTo(frame(1).blobs[0].x, 3);
  });

  it('grows the mass with its size', () => {
    const area = (mass: number) => frame(1, { ...PARAMS, mass }).blobs.reduce((s, b) => s + b.r * b.r, 0);

    expect(area(1.4)).toBeGreaterThan(area(1));
  });

  it('shows the title on its own beat, gone again before the loop closes', () => {
    expect(frame(0).words.every((w) => w.opacity === 0)).toBe(true);
    expect(frame(PARAMS.titleAt + 2).words.every((w) => w.opacity > 0.99)).toBe(true);
    expect(frame(LENGTH - 0.5).words.every((w) => w.opacity === 0)).toBe(true);
    expect(frame(PARAMS.titleAt + 2).dim).toBeGreaterThan(0);
    expect(frame(0).dim).toBe(0);
  });

  it('has no title beat without a title', () => {
    const f = frame(PARAMS.titleAt + 2, { ...PARAMS, title: '  ' });

    expect(f.words).toHaveLength(0);
    expect(f.dim).toBe(0);
  });

  it('reads colours as 0..1 triples', () => {
    expect(model.hexRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(model.hexRgb('#abc')).toEqual([0xaa / 255, 0xbb / 255, 0xcc / 255]);
    expect(model.hexRgb('nope')).toEqual([0, 0, 0]);
  });
});
