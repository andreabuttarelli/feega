import { describe, expect, it } from 'vitest';
import { ROWS_MODEL } from './model';

type Card = { slot: number; photo: number; x: number; w: number };
type Row = { y: number; cards: Card[] };
type Title = { gap: number; words: { opacity: number; rise: number }[] };
type Model = {
  rowsFrame: (p: object, t: number, length: number, width: number, height: number, items: number) => Row[];
  titleFrame: (p: object, t: number, length: number, count: number) => Title;
};

const model = new Function(`${ROWS_MODEL}; return { rowsFrame, titleFrame };`)() as Model;

const PARAMS = { count: 10, cardSize: 0.21, gap: 0.19, margin: 0.02, spacing: 0.135, speed: 0.42, direction: 'left', delay: 0.5, stagger: 0.32, tighten: 0 };
const LENGTH = 12;
const FPS = 30;
const WORDS = 4;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const placed = (row: Row, half: number) => row.cards.filter((c) => Math.abs(c.x) - c.w / 2 < half).sort((a, b) => a.x - b.x).map((c) => [c.photo, c.x]);

describe('the rows and spaced title model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 4.1, 9.7, 11.9];
    const frame = (t: number) => [model.rowsFrame(PARAMS, t, LENGTH, 1920, 1080, 9), model.titleFrame(PARAMS, t, LENGTH, WORDS)];
    const forward = at.map(frame);
    const backward = [...at].reverse().map(frame).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: rows land where they started and the title is gone at both ends', () => {
    for (const items of [0, 2, 9, 5]) {
      const first = model.rowsFrame(PARAMS, 0, LENGTH, 1920, 1080, items);
      const last = model.rowsFrame(PARAMS, LENGTH, LENGTH, 1920, 1080, items);
      first.forEach((row, i) => {
        const a = placed(row, 0.9);
        const b = placed(last[i], 0.9);
        expect(b.map((c) => c[0])).toEqual(a.map((c) => c[0]));
        b.forEach((c, j) => expect(c[1]).toBeCloseTo(a[j][1] as number, 9));
      });
    }
    for (const t of [0, LENGTH]) {
      expect(Math.max(...model.titleFrame(PARAMS, t, LENGTH, WORDS).words.map((w) => w.opacity))).toBeLessThan(1e-3);
    }
  });

  it('glides at constant speed, the two rows in opposite directions', () => {
    const step = (row: number, t: number) => {
      const a = model.rowsFrame(PARAMS, t, LENGTH, 1920, 1080, 9)[row].cards[0].x;
      const b = model.rowsFrame(PARAMS, t + 1 / FPS, LENGTH, 1920, 1080, 9)[row].cards[0].x;
      return b - a;
    };
    const top = [1, 5, 9].map((t) => step(0, t));
    const bottom = [1, 5, 9].map((t) => step(1, t));

    top.forEach((s) => expect(s).toBeCloseTo(top[0], 9));
    bottom.forEach((s) => expect(s).toBeCloseTo(bottom[0], 9));
    expect(Math.sign(top[0])).toBe(-Math.sign(bottom[0]));
    expect(top[0]).toBeLessThan(0);
  });

  it('splits the photos between the rows when there are enough of them', () => {
    const [top, bottom] = model.rowsFrame(PARAMS, 0, LENGTH, 1920, 1080, 9);
    const ids = (row: Row) => new Set(row.cards.map((c) => c.photo));

    expect([...ids(top)].every((i) => !ids(bottom).has(i))).toBe(true);
    expect(ids(top).size + ids(bottom).size).toBe(9);
  });

  it('wraps cards only out of sight, keeps them evenly spaced and the rows inside the frame', () => {
    for (const [name, [width, height]] of Object.entries(ASPECTS)) {
      const half = width / Math.min(width, height) / 2;
      const halfY = height / Math.min(width, height) / 2;
      const frames = times().filter((_, i) => i % 3 === 0).map((t) => model.rowsFrame(PARAMS, t, LENGTH, width, height, 9));
      frames.slice(1).forEach((f, i) => {
        f.forEach((row, r) => {
          expect(Math.abs(row.y) + PARAMS.cardSize / 2, name).toBeLessThanOrEqual(halfY);
          const xs = row.cards.map((c) => c.x).sort((a, b) => a - b);
          xs.slice(1).forEach((x, k) => expect(x - xs[k]).toBeCloseTo(PARAMS.cardSize + PARAMS.gap, 9));
          for (const c of row.cards) {
            const before = frames[i][r].cards.find((b) => b.slot === c.slot)!;
            if (Math.abs(c.x - before.x) > 0.5) {
              expect(Math.min(Math.abs(c.x), Math.abs(before.x)) - c.w / 2, name).toBeGreaterThan(half);
            }
          }
        });
      });
    }
  });

  it('brings the words in one by one, each moving while it fades, never backwards', () => {
    const frames = times().map((t) => model.titleFrame(PARAMS, t, LENGTH, WORDS));
    const entering = frames.slice(0, 4 * FPS);
    for (let w = 0; w < WORDS; w++) {
      entering.slice(1).forEach((f, i) => {
        expect(f.words[w].opacity).toBeGreaterThanOrEqual(entering[i].words[w].opacity - 1e-12);
        expect(f.words[w].rise).toBeLessThanOrEqual(entering[i].words[w].rise + 1e-12);
      });
    }
    const at = 0.5 + 0.32 + 0.2;
    const f = model.titleFrame(PARAMS, at, LENGTH, WORDS);

    expect(f.words[0].opacity).toBeGreaterThan(f.words[1].opacity);
    expect(f.words[1].opacity).toBeGreaterThan(0);
    expect(f.words[2].opacity).toBe(0);
    expect(model.titleFrame(PARAMS, 6, LENGTH, WORDS).words.every((w) => w.opacity === 1 && w.rise === 0)).toBe(true);
  });

  it('keeps the spacing unless asked to close it, then closes it smoothly', () => {
    const gaps = (p: object) => times().map((t) => model.titleFrame(p, t, LENGTH, WORDS).gap);

    expect(new Set(gaps(PARAMS)).size).toBe(1);
    const closing = gaps({ ...PARAMS, tighten: 0.6 });
    const steps = closing.slice(1).map((g, i) => g - closing[i]);
    expect(steps.every((s) => s <= 1e-12)).toBe(true);
    expect(Math.max(...steps.map(Math.abs))).toBeLessThan(0.015);
    expect(closing.at(-1)).toBeCloseTo(0.135 * 0.4, 6);
  });
});
