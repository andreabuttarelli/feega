import { describe, expect, it } from 'vitest';
import { POSTER_GLASS_MODEL } from './model';

type Box = { x: number; y: number; w: number; h: number };
type Node = [number, number, number];
type Line = { text: string; muted: boolean };
type Block = { role: string; text: string; x: number; y: number; size: number; align: 'left' | 'right'; muted: boolean };
type Model = {
  posterBox: (width: number, height: number) => Box;
  columnLines: (text: string) => Line[];
  posterBlocks: (p: object, poster: Box, widthEm: (text: string) => number) => Block[];
  blobNodes: (p: object, t: number, length: number) => Node[];
  BLOB_EDGES: [number, number][];
  BODY_COUNT: number;
  DROPS: number[][];
  MELT: number;
  POSTER_ASPECT: number;
  TYPE_ASCENT: number;
  TYPE_DESCENT: number;
};

const model = new Function(`${POSTER_GLASS_MODEL}; return { posterBox, columnLines, posterBlocks, blobNodes, BLOB_EDGES, BODY_COUNT, DROPS, MELT, POSTER_ASPECT, TYPE_ASCENT, TYPE_DESCENT };`)() as Model;

const PARAMS = { glassSize: 1, flow: 1, wander: 1, seed: 3 };
const COPY = { intro: 'Spring sessions\n~on sound', details: '~Talks and walks\nFree entry', headline: 'Murmur', dates: '07.—\n19.\n~Apr', venue: 'Halde Pavilion\n~Mirrow Quay', footer: '~No. 04' };
const POSTER = { x: 0, y: 0, w: 700, h: 1000 };
const widthEm = (text: string) => text.length * 0.55;
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

  it('joins every body node into one stream, the drops apart', () => {
    const count = model.BODY_COUNT;
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
    expect(model.columnLines('Murmur\n~07.—\n\n  ~Apr ')).toEqual([
      { text: 'Murmur', muted: false },
      { text: '07.—', muted: true },
      { text: '', muted: false },
      { text: 'Apr', muted: true }
    ]);
  });

  const boxOf = (b: Block) => {
    const w = widthEm(b.text) * b.size;
    const left = b.align === 'left' ? b.x : b.x - w;
    return { left, right: left + w, top: b.y - b.size * model.TYPE_ASCENT, bottom: b.y + b.size * model.TYPE_DESCENT };
  };

  it('sets every line inside the poster margins', () => {
    for (const b of model.posterBlocks(COPY, POSTER, widthEm)) {
      const box = boxOf(b);

      expect(box.left).toBeGreaterThanOrEqual(POSTER.x);
      expect(box.right).toBeLessThanOrEqual(POSTER.x + POSTER.w + 1e-6);
      expect(box.top).toBeGreaterThan(POSTER.y);
      expect(box.bottom).toBeLessThan(POSTER.y + POSTER.h);
    }
  });

  it('never lets two lines collide', () => {
    const boxes = model.posterBlocks(COPY, POSTER, widthEm).filter((b) => b.text).map(boxOf);
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
      const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;

      expect(apart).toBe(true);
    }));
  });

  it('makes one huge word the poster, with type in at least three sizes around it', () => {
    const blocks = model.posterBlocks(COPY, POSTER, widthEm);
    const headline = blocks.find((b) => b.role === 'headline')!;
    const sizes = new Set(blocks.map((b) => Math.round(b.size)));

    expect(headline.text).toBe('Murmur');
    expect(Math.max(...blocks.map((b) => b.size))).toBe(headline.size);
    expect(widthEm(headline.text) * headline.size).toBeGreaterThan(POSTER.w * 0.8);
    expect(sizes.size).toBeGreaterThanOrEqual(3);
  });

  it('marks grey lines with a tilde in every block', () => {
    const dates = model.posterBlocks(COPY, POSTER, widthEm).filter((b) => b.role === 'dates');

    expect(dates.map((b) => [b.text, b.muted])).toEqual([['07.—', false], ['19.', false], ['Apr', true]]);
  });

  it('shrinks a block whose line is too long, instead of running off the poster', () => {
    const long = model.posterBlocks({ ...COPY, dates: 'a very long line of dates' }, POSTER, widthEm).find((b) => b.role === 'dates')!;

    expect(boxOf(long).right).toBeLessThanOrEqual(POSTER.w + 1e-6);
  });

  const gaps = (t: number) => {
    const nodes = model.blobNodes(PARAMS, t, LENGTH);
    return model.DROPS.map(([anchor], k) => {
      const [x, y, r] = nodes[model.BODY_COUNT + k];
      const [ax, ay, ar] = nodes[anchor];
      return Math.hypot(x - ax, y - ay) - r - ar;
    });
  };

  it('lets drops break away from the body and melt back in', () => {
    const all = times().map(gaps);
    model.DROPS.forEach((_, k) => {
      const path = all.map((g) => g[k]);

      expect(Math.max(...path)).toBeGreaterThan(model.MELT);
      expect(Math.min(...path)).toBeLessThan(0);
    });
  });

  it('breaks the drops away at different moments, set by the seed', () => {
    const widest = (seed: number) => model.DROPS.map((_, k) => {
      const path = times().map((t) => {
        const nodes = model.blobNodes({ ...PARAMS, seed }, t, LENGTH);
        const [x, y, r] = nodes[model.BODY_COUNT + k];
        const [ax, ay, ar] = nodes[model.DROPS[k][0]];
        return Math.hypot(x - ax, y - ay) - r - ar;
      });
      return path.indexOf(Math.max(...path));
    });

    expect(new Set(widest(3)).size).toBeGreaterThan(model.DROPS.length / 2);
    expect(widest(4)).not.toEqual(widest(3));
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
