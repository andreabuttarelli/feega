import { describe, expect, it } from 'vitest';
import { PGRID_MODEL } from './model';

type Column = { x: number; w: number; tileH: number; pitch: number; n: number; cycles: number; dir: number; start: number };
type Tile = { y: number; item: number };
type ColumnFrame = { travel: number; tiles: Tile[] };
type Frame = { scale: number; columns: ColumnFrame[]; words: { y: number; opacity: number }[]; veil: number };
type Model = {
  gridLayout: (p: object, aspect: number) => Column[];
  gridFrame: (layout: Column[], p: object, t: number, length: number, aspect: number) => Frame;
  scrollAt: (p: object, t: number, length: number) => number;
  MOTIONS: Record<string, unknown>;
};

const model = new Function(`${PGRID_MODEL}; return { gridLayout, gridFrame, scrollAt, MOTIONS };`)() as Model;

const PARAMS = { motion: 'parallax', columns: 4, gap: 0.012, tileAspect: 0.75, speed: 1, spread: 0.6, scroll: 'segments', segments: 3, showTitle: false, title: 'scroll through it', titleAt: 2 };
const MOTIONS = ['parallax', 'alternate', 'stagger', 'zoom', 'drift'];
const ASPECTS = { landscape: 9 / 16, vertical: 16 / 9, square: 1 };
const LENGTH = 10;
const FPS = 30;
const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const with_ = (extra: object) => ({ ...PARAMS, ...extra });
const frameOf = (p: object, t: number, aspect = ASPECTS.landscape) => model.gridFrame(model.gridLayout(p, aspect), p, t, LENGTH, aspect);

describe('the parallax grid model', () => {
  it('offers exactly the five motions', () => {
    expect(Object.keys(model.MOTIONS)).toEqual(MOTIONS);
  });

  it.each(Object.entries(ASPECTS))('fills the %s frame edge to edge with the asked columns', (_, aspect) => {
    for (const columns of [3, 4, 5, 6]) {
      const layout = model.gridLayout(with_({ columns }), aspect);
      const right = layout[layout.length - 1];

      expect(layout).toHaveLength(columns);
      expect(layout[0].x).toBeCloseTo(PARAMS.gap, 9);
      expect(right.x + right.w).toBeCloseTo(1 - PARAMS.gap, 9);
      layout.forEach((c) => expect(c.n * c.pitch).toBeGreaterThan(aspect + c.pitch));
    }
  });

  it('moves the columns at different speeds, each a whole number of its own periods per loop', () => {
    const layout = model.gridLayout(PARAMS, ASPECTS.landscape);
    const travel = (i: number) => frameOf(PARAMS, LENGTH).columns[i].travel - frameOf(PARAMS, 0).columns[i].travel;
    const distances = layout.map((_, i) => Math.abs(travel(i)));

    layout.forEach((c, i) => expect(distances[i] / (c.n * c.pitch)).toBeCloseTo(Math.round(distances[i] / (c.n * c.pitch)), 9));
    expect(new Set(distances.map((d) => d.toFixed(6))).size).toBeGreaterThan(1);
  });

  it('alternate sends odd columns one way and even columns the other', () => {
    const dirs = model.gridLayout(with_({ motion: 'alternate' }), ASPECTS.landscape).map((c) => c.dir);

    expect(dirs).toEqual([-1, 1, -1, 1]);
    expect(model.gridLayout(PARAMS, ASPECTS.landscape).every((c) => c.dir === -1)).toBe(true);
  });

  it('scroll progress never runs backwards and covers one whole loop', () => {
    for (const scroll of ['segments', 'continuous']) {
      const p = with_({ scroll });
      const path = times().map((t) => model.scrollAt(p, t, LENGTH));

      path.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(path[i] - 1e-12));
      expect(path[path.length - 1] - path[0]).toBeCloseTo(1, 9);
    }
  });

  it('segments rest between moves and move with no jump between frames', () => {
    const path = times().map((t) => model.scrollAt(PARAMS, t, LENGTH));
    const steps = path.slice(1).map((v, i) => v - path[i]);
    const rests = steps.filter((s) => s < 1e-6).length;

    expect(rests).toBeGreaterThan(steps.length * 0.1);
    expect(Math.max(...steps)).toBeLessThan(0.05);
  });

  it('leaves and reaches each rest without a jump', () => {
    const path = times().map((t) => model.scrollAt(PARAMS, t, LENGTH));
    const steps = path.slice(1).map((v, i) => v - path[i]);
    const edges = steps.filter((s, i) => s > 0 && (steps[i - 1] === 0 || steps[i + 1] === 0));

    expect(edges.length).toBeGreaterThan(0);
    edges.forEach((s) => expect(s).toBeLessThan(1e-4));
  });

  it.each(MOTIONS)('%s wraps each column on a seam nobody sees', (motion) => {
    for (const aspect of Object.values(ASPECTS)) {
      const p = with_({ motion });
      const layout = model.gridLayout(p, aspect);
      times().forEach((t) => {
        model.gridFrame(layout, p, t, LENGTH, aspect).columns.forEach((c, i) => {
          const col = layout[i];
          const ys = c.tiles.map((tile) => tile.y).sort((a, b) => a - b);
          ys.slice(1).forEach((y, k) => expect(y - ys[k]).toBeCloseTo(col.pitch, 6));
          expect(ys[0]).toBeLessThanOrEqual(0);
          expect(ys[ys.length - 1] + col.tileH).toBeGreaterThanOrEqual(aspect);
        });
      });
    }
  });

  it.each(MOTIONS)('%s closes the loop: the last frame matches the first', (motion) => {
    const p = with_({ motion, showTitle: true });
    const first = frameOf(p, 0);
    const last = frameOf(p, LENGTH);

    expect(last.scale).toBeCloseTo(first.scale, 9);
    expect(last.veil).toBeCloseTo(first.veil, 6);
    first.columns.forEach((c, i) => {
      const ys = (f: ColumnFrame) => f.tiles.map((tile) => `${tile.item}@${tile.y.toFixed(6)}`).sort();
      expect(ys(last.columns[i])).toEqual(ys(c));
    });
    first.words.forEach((w, i) => expect(last.words[i].opacity).toBeCloseTo(w.opacity, 6));
  });

  it.each(MOTIONS)('%s moves every tile smoothly: no frame-to-frame jump', (motion) => {
    const p = with_({ motion });
    const layout = model.gridLayout(p, ASPECTS.landscape);
    const frames = times().map((t) => model.gridFrame(layout, p, t, LENGTH, ASPECTS.landscape));
    frames.slice(1).forEach((f, k) => {
      f.columns.forEach((c, i) => expect(Math.abs(c.travel - frames[k].columns[i].travel)).toBeLessThan(layout[i].pitch * 0.5));
      expect(Math.abs(f.scale - frames[k].scale)).toBeLessThan(0.01);
    });
  });

  it('stagger starts the columns one after another', () => {
    const p = with_({ motion: 'stagger' });
    const firstMove = (i: number) => times().find((t) => Math.abs(frameOf(p, t).columns[i].travel - frameOf(p, 0).columns[i].travel) > 1e-4)!;

    expect(firstMove(1)).toBeGreaterThan(firstMove(0));
    expect(firstMove(3)).toBeGreaterThan(firstMove(2));
  });

  it('zoom gives the columns different depths; the others keep one width', () => {
    const widths = (motion: string) => new Set(model.gridLayout(with_({ motion }), ASPECTS.landscape).map((c) => c.w.toFixed(6))).size;

    expect(widths('zoom')).toBeGreaterThan(1);
    expect(widths('parallax')).toBe(1);
  });

  it('drift moves slowly and without rests', () => {
    const p = with_({ motion: 'drift' });
    const path = times().map((t) => frameOf(p, t).columns[0].travel);
    const steps = path.slice(1).map((v, i) => Math.abs(v - path[i]));

    expect(Math.min(...steps)).toBeGreaterThan(0);
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(1e-9);
  });

  it('gives neighbouring tiles different pictures', () => {
    const f = frameOf(PARAMS, 3);
    f.columns.forEach((c) => expect(new Set(c.tiles.map((t) => t.item)).size).toBe(c.tiles.length));
  });

  it('keeps the title hidden unless asked for', () => {
    expect(frameOf(PARAMS, 5).words.every((w) => w.opacity === 0)).toBe(true);
    expect(frameOf(with_({ showTitle: true }), 5).words.every((w) => w.opacity > 0.99)).toBe(true);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 2, 6.4, 9.8];
    for (const motion of MOTIONS) {
      const p = with_({ motion });
      const forward = at.map((t) => frameOf(p, t));
      const backward = [...at].reverse().map((t) => frameOf(p, t)).reverse();
      expect(backward).toEqual(forward);
    }
  });
});
