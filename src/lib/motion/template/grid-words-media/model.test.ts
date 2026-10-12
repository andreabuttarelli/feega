import { describe, expect, it } from 'vitest';
import { GRID_MODEL } from './model';

type Item = { kind: 'word' | 'media'; phrase: number; order: number; text: string; media: number; x: number; y: number; w: number; h: number; size: number; chip: number; opacity: number; rise: number; reveal: number; zoom: number };
type Frame = { cell: number; ox: number; oy: number; items: Item[] };
type Model = { gridFrame: (p: object, t: number, length: number, width: number, height: number) => Frame };

const model = new Function(`${GRID_MODEL}; return { gridFrame };`)() as Model;

const PARAMS = { phrases: 'this will never be the same', cells: 9, textSize: 0.5, seed: 7, beat: 0.5, lead: 0.4 };
const LENGTH = 12;
const FPS = 30;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frame = (t: number, [w, h]: readonly [number, number] = ASPECTS.landscape, p: object = PARAMS) => model.gridFrame(p, t, LENGTH, w, h);
const shown = (c: Item) => Math.min(c.opacity, Math.max(c.chip, c.reveal));
const onGrid = (v: number, origin: number, cell: number) => Math.abs((v - origin) / cell - Math.round((v - origin) / cell)) < 1e-6;

describe('the grid words and media model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 3, 7.6, 11.2];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: the first and the last frame are the same empty grid', () => {
    for (const size of Object.values(ASPECTS)) {
      expect(frame(0, size).items.every((c) => shown(c) === 0)).toBe(true);
      expect(frame(LENGTH, size).items.every((c) => shown(c) < 1e-6)).toBe(true);
    }
  });

  it('reveals the sentence word by word with a picture between each pair', () => {
    const items = frame(6).items;
    const order = [...items].sort((a, b) => a.order - b.order);

    expect(order.filter((c) => c.kind === 'word').map((c) => c.text)).toEqual(['this', 'will', 'never', 'be', 'the', 'same']);
    expect(order.map((c) => c.kind)).toEqual(['word', 'media', 'word', 'media', 'word', 'media', 'word', 'media', 'word', 'media', 'word']);
  });

  it('enters monotonically: nothing flickers back while arriving or holding', () => {
    const all = times().map((t) => frame(t).items);
    all[0].forEach((_, i) => {
      const values = all.map((items) => shown(items[i]));
      const peak = values.indexOf(Math.max(...values));
      values.slice(1, peak + 1).forEach((v, k) => expect(v).toBeGreaterThanOrEqual(values[k] - 1e-9));
      const last = values.lastIndexOf(Math.max(...values));
      values.slice(last + 1).forEach((v, k) => expect(v).toBeLessThanOrEqual(values[last + k] + 1e-9));
    });
  });

  it('moves without jumps: no item changes by more than a frame-sized step', () => {
    const all = times().map((t) => frame(t).items);
    for (let f = 1; f < all.length; f++) {
      all[f].forEach((c, i) => expect(Math.abs(shown(c) - shown(all[f - 1][i]))).toBeLessThan(0.35));
    }
  });

  it.each(Object.entries(ASPECTS))('snaps every chip and picture to the %s grid, inside the frame, never overlapping', (_, size) => {
    const [w, h] = size;
    const f = frame(6, size);

    expect(f.items).toHaveLength(11);
    for (const c of f.items) {
      expect(onGrid(c.x, f.ox, f.cell) && onGrid(c.y, f.oy, f.cell) && onGrid(c.x + c.w, f.ox, f.cell) && onGrid(c.y + c.h, f.oy, f.cell)).toBe(true);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(w);
      expect(c.y + c.h).toBeLessThanOrEqual(h);
    }
    f.items.forEach((a, i) =>
      f.items.slice(i + 1).forEach((b) => {
        const apart = a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6;
        expect(apart, `${a.text || 'media'} overlaps ${b.text || 'media'}`).toBe(true);
      })
    );
  });

  it('gives every word a chip wide enough for its text', () => {
    for (const c of frame(6).items.filter((i) => i.kind === 'word')) {
      expect(c.w).toBeGreaterThanOrEqual(c.text.length * 0.5 * c.size);
    }
  });

  it('a different seed scatters the same sentence differently', () => {
    const at = (seed: number) => frame(6, ASPECTS.landscape, { ...PARAMS, seed }).items.map((c) => [c.x, c.y]);

    expect(at(1)).not.toEqual(at(2));
  });
});
