import { describe, expect, it } from 'vitest';
import { PAPER_MODEL } from './model';

type Line = { text: string; size: number; y: number; opacity: number; rise: number };
type Pose = { x: number; y: number; ry: number; rx: number; rz: number };
type Card = { kind: string; x: number; y: number; w: number; h: number; z: number };
type Facet = { points: number[][]; normal: number[] };
type Model = {
  paperLayout: (aspect: number) => Card[];
  counterValues: (p: object) => number[];
  counterSizes: (count: number, width: number, height: number, chars: number) => number[];
  counterFrame: (p: object, t: number, length: number) => Line[];
  cardPose: (card: Card, i: number, t: number, length: number) => Pose;
  crumple: (seed: number, cols: number, rows: number) => Facet[];
  facetShade: (normal: number[], pose: Pose) => number;
  paperEdge: (seed: number, count: number, rough: number) => number[][];
  sketchDrawn: (t: number, length: number) => number;
};

const model = new Function(`${PAPER_MODEL}; return { paperLayout, counterValues, counterSizes, counterFrame, cardPose, crumple, facetShade, paperEdge, sketchDrawn };`)() as Model;

const PARAMS = { from: 430000, to: 490000, lines: 7, prefix: '$', startAt: 0.5, lineSeconds: 0.9 };
const LENGTH = 12;
const FPS = 60;
const times = (from = 0, until = LENGTH) => Array.from({ length: Math.round((until - from) * FPS) + 1 }, (_, i) => from + i / FPS);

describe('the paper cutouts counter model', () => {
  it('counts from the first value to the last, always up', () => {
    const values = model.counterValues(PARAMS);

    expect(values).toHaveLength(7);
    expect(values[0]).toBe(430000);
    expect(values[6]).toBe(490000);
    values.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(values[i]));
  });

  it('writes each new line bigger, and the whole list fits the panel', () => {
    const sizes = model.counterSizes(7, 1, 1.2, 8);

    sizes.slice(1).forEach((s, i) => expect(s).toBeGreaterThan(sizes[i]));
    expect(sizes.reduce((a, b) => a + b, 0) * 1.12).toBeLessThanOrEqual(1.2 + 1e-9);
    expect(sizes[6] * 8 * 0.6).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('grows the list line by line, never taking one back before the end', () => {
    const shown = times(0, 10).map((t) => model.counterFrame(PARAMS, t, LENGTH).filter((l) => l.opacity > 0.5).length);

    shown.slice(1).forEach((n, i) => expect(n).toBeGreaterThanOrEqual(shown[i]));
    expect(shown[0]).toBe(0);
    expect(shown[shown.length - 1]).toBe(7);
  });

  it('shows the last value on the last line once it has landed', () => {
    const lines = model.counterFrame(PARAMS, 9, LENGTH);

    expect(lines[6].text).toBe('$490,000');
    expect(lines[0].text).toBe('$430,000');
  });

  it('closes the loop: the list is empty at both ends', () => {
    model.counterFrame(PARAMS, 0, LENGTH).forEach((l) => expect(l.opacity).toBe(0));
    model.counterFrame(PARAMS, LENGTH, LENGTH).forEach((l) => expect(l.opacity).toBeCloseTo(0, 6));
  });

  it('floats the cards in a loop, without a jerk', () => {
    model.paperLayout(16 / 9).forEach((card, i) => {
      expect(model.cardPose(card, i, 0, LENGTH)).toEqual(model.cardPose(card, i, LENGTH, LENGTH));
      const ry = times().map((t) => model.cardPose(card, i, t, LENGTH).ry);
      const steps = ry.slice(1).map((r, k) => r - ry[k]);
      steps.slice(1).forEach((s, k) => expect(Math.abs(s - steps[k])).toBeLessThan(0.01));
    });
  });

  it('keeps every card inside the frame in every format', () => {
    [16 / 9, 1, 9 / 16].forEach((aspect) => {
      const halfW = aspect >= 1 ? aspect / 2 : 0.5;
      const halfH = aspect >= 1 ? 0.5 : 0.5 / aspect;
      model.paperLayout(aspect).forEach((c) => {
        expect(Math.abs(c.x) + c.w / 2).toBeLessThan(halfW);
        expect(Math.abs(c.y) + c.h / 2).toBeLessThan(halfH);
      });
    });
  });

  it('puts the counter panel in front of the cutouts', () => {
    const cards = model.paperLayout(16 / 9);
    const panel = cards.find((c) => c.kind === 'panel')!;

    cards.filter((c) => c !== panel).forEach((c) => expect(panel.z).toBeGreaterThan(c.z));
  });

  it('crumples a sheet into facets that cover it, the same for the same seed', () => {
    const facets = model.crumple(7, 5, 6);

    expect(facets).toHaveLength(5 * 6 * 2);
    expect(model.crumple(7, 5, 6)).toEqual(facets);
    expect(model.crumple(8, 5, 6)).not.toEqual(facets);
    facets.forEach((f) => expect(Math.hypot(...f.normal)).toBeCloseTo(1, 6));
  });

  it('lights a facet by how it faces the light, flat paper stays unshaded', () => {
    const still = { x: 0, y: 0, ry: 0, rx: 0, rz: 0 };

    expect(model.facetShade([0, 0, 1], still)).toBeCloseTo(0, 6);
    expect(model.facetShade([-0.4, -0.4, 0.82], still)).toBeGreaterThan(0);
    expect(model.facetShade([0.4, 0.4, 0.82], still)).toBeLessThan(0);
  });

  it('tears an irregular edge around the sheet, inside its box', () => {
    const edge = model.paperEdge(3, 40, 0.06);

    expect(edge).toHaveLength(40);
    edge.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    });
  });

  it('draws the sketch in and takes it back for the loop', () => {
    expect(model.sketchDrawn(0, LENGTH)).toBe(0);
    expect(model.sketchDrawn(6, LENGTH)).toBe(1);
    expect(model.sketchDrawn(LENGTH, LENGTH)).toBeCloseTo(0, 6);
  });

  it('is a pure function of t', () => {
    const at = [0.3, 2, 6.4, 11.8];
    const forward = at.map((t) => model.counterFrame(PARAMS, t, LENGTH));
    const backward = [...at].reverse().map((t) => model.counterFrame(PARAMS, t, LENGTH)).reverse();
    expect(backward).toEqual(forward);
  });
});
