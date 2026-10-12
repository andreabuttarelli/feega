import { describe, expect, it } from 'vitest';
import { POSTER_GLASS_MODEL } from './model';

type Box = { x: number; y: number; w: number; h: number };
type Node = [number, number, number];
type Line = { text: string; muted: boolean };
type Model = {
  posterBox: (width: number, height: number) => Box;
  columnLines: (text: string) => Line[];
  typeSize: (rows: number, widestEm: number, poster: Box) => number;
  blobNodes: (p: object, t: number, length: number) => Node[];
  BLOB_EDGES: [number, number][];
  POSTER_ASPECT: number;
  TYPE_LEADING: number;
};

const model = new Function(`${POSTER_GLASS_MODEL}; return { posterBox, columnLines, typeSize, blobNodes, BLOB_EDGES, POSTER_ASPECT, TYPE_LEADING };`)() as Model;

const PARAMS = { glassSize: 1, flow: 1, wander: 1 };
const LENGTH = 10;
const FPS = 60;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080], portrait: [1080, 1350] } as const;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);

describe('the poster liquid glass model', () => {
  it('is a pure function of t: any seek order gives the same glass', () => {
    const at = [0.4, 3, 7.2, 9.6];
    const forward = at.map((t) => model.blobNodes(PARAMS, t, LENGTH));
    const backward = [...at].reverse().map((t) => model.blobNodes(PARAMS, t, LENGTH)).reverse();

    expect(backward).toEqual(forward);
  });

  it('loops: the last frame is the first frame', () => {
    const first = model.blobNodes(PARAMS, 0, LENGTH);
    const last = model.blobNodes(PARAMS, LENGTH, LENGTH);

    first.forEach((node, i) => node.forEach((v, k) => expect(last[i][k]).toBeCloseTo(v, 6)));
  });

  it('flows: the glass keeps moving through the whole loop', () => {
    const path = times().map((t) => model.blobNodes(PARAMS, t, LENGTH));
    const still = path.slice(1).filter((nodes, k) => nodes.every((n, i) => Math.hypot(n[0] - path[k][i][0], n[1] - path[k][i][1]) < 1e-5));

    expect(still).toHaveLength(0);
  });

  it('moves without a jolt: no node changes speed abruptly between frames', () => {
    const path = times().map((t) => model.blobNodes(PARAMS, t, LENGTH));
    for (const i of path[0].keys()) {
      const steps = path.slice(1).map((nodes, k) => Math.hypot(nodes[i][0] - path[k][i][0], nodes[i][1] - path[k][i][1]));
      const jolts = steps.slice(1).map((s, k) => Math.abs(s - steps[k]));

      expect(Math.max(...jolts)).toBeLessThan(Math.max(...steps) * 0.1);
    }
  });

  it('keeps the glass on the poster', () => {
    const height = 1 / model.POSTER_ASPECT;
    for (const t of times().filter((_, i) => i % 10 === 0)) {
      for (const [x, y, r] of model.blobNodes(PARAMS, t, LENGTH)) {
        expect(x - r).toBeGreaterThan(0);
        expect(x + r).toBeLessThan(1);
        expect(y - r).toBeGreaterThan(0);
        expect(y + r).toBeLessThan(height);
      }
    }
  });

  it('joins every edge between real nodes, as one stream', () => {
    const count = model.blobNodes(PARAMS, 0, LENGTH).length;
    const reached = new Set([0]);
    for (let round = 0; round < count; round++) {
      model.BLOB_EDGES.filter(([a, b]) => reached.has(a) || reached.has(b)).forEach(([a, b]) => reached.add(a).add(b));
    }

    model.BLOB_EDGES.flat().forEach((i) => expect(i).toBeLessThan(count));
    expect(reached.size).toBe(count);
  });

  it('mixes fat pools and thin tendrils, like poured liquid', () => {
    const radii = model.blobNodes(PARAMS, 0, LENGTH).map((n) => n[2]);

    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(3);
  });

  it('marks muted lines with a leading tilde and keeps the rest ink', () => {
    expect(model.columnLines('Lectures\n~24.–\n\n  ~Sep ')).toEqual([
      { text: 'Lectures', muted: false },
      { text: '24.–', muted: true },
      { text: '', muted: false },
      { text: 'Sep', muted: true }
    ]);
  });

  it('sizes the type to the taller column, or to the widest row when that is tighter', () => {
    const poster = { x: 0, y: 0, w: 720, h: 1000 };
    const tall = model.typeSize(13, 3, poster);
    const wide = model.typeSize(13, 9, poster);

    const block = (size: number) => size * 13 * model.TYPE_LEADING;

    expect(block(tall)).toBeLessThan(poster.h);
    expect(block(tall)).toBeGreaterThan(poster.h * 0.8);
    expect(wide).toBeLessThan(tall);
    expect(wide * 9).toBeLessThan(poster.w);
  });

  for (const [name, [width, height]] of Object.entries(ASPECTS)) {
    it(`hangs the poster inside the frame with wall around it in ${name}`, () => {
      const box = model.posterBox(width, height);

      expect(box.w / box.h).toBeCloseTo(model.POSTER_ASPECT, 3);
      expect(box.x).toBeGreaterThan(0);
      expect(box.x + box.w).toBeLessThan(width);
      expect(box.y).toBeGreaterThan(height * 0.03);
      expect(box.y + box.h).toBeLessThan(height);
      expect(box.h).toBeGreaterThan(Math.min(height, width / model.POSTER_ASPECT) * 0.75);
    });
  }
});
