import { describe, expect, it } from 'vitest';
import { EDITORIAL_MODEL } from './model';

type Cell = { kind: 'text' | 'media' | 'quote'; phrase: number; row: number; text: string; media: number; x: number; y: number; w: number; h: number; size: number; align: string; opacity: number; rise: number; reveal: number };
type Frame = { cells: Cell[] };
type Model = { editorialFrame: (p: object, t: number, length: number, width: number, height: number) => Frame };

const model = new Function(`${EDITORIAL_MODEL}; return { editorialFrame };`)() as Model;

const PARAMS = { phrases: 'there / needs to be / a jingle\nevery brand / has a / sound\nmake it / impossible / to forget', quote: true, fontSize: 0.175, margin: 0.035, mediaWidth: 0.27, mediaAspect: 1.6, beat: 0.42, lead: 0.15 };
const LENGTH = 15;
const FPS = 30;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;
const CHAR_EM = 0.56;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frame = (t: number, [w, h]: readonly [number, number] = ASPECTS.landscape) => model.editorialFrame(PARAMS, t, LENGTH, w, h);
const shown = (c: Cell) => Math.max(c.opacity, c.reveal);
const textWidth = (c: Cell) => (c.kind === 'media' ? c.w : c.text.length * CHAR_EM * c.size);
const left = (c: Cell) => (c.align === 'right' && c.kind !== 'media' ? c.x - textWidth(c) : c.x);

describe('the editorial words and media model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 3, 7.6, 14.2];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: the first and the last frame are the same empty page', () => {
    for (const size of Object.values(ASPECTS)) {
      expect(frame(0, size).cells.every((c) => shown(c) === 0)).toBe(true);
      expect(frame(LENGTH, size).cells.every((c) => shown(c) < 1e-6)).toBe(true);
    }
  });

  it('plays one phrase at a time, three in sequence, each with words, media and a quote', () => {
    const live = (t: number) => [...new Set(frame(t).cells.filter((c) => shown(c) > 0.01).map((c) => c.phrase))];

    expect(live(3)).toEqual([0]);
    expect(live(8)).toEqual([1]);
    expect(live(13)).toEqual([2]);
    const kinds = frame(3).cells.filter((c) => c.phrase === 0).map((c) => c.kind);
    expect(kinds.filter((k) => k === 'text')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'media')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'quote')).toHaveLength(1);
  });

  it('reveals in rhythm: word, picture, word, picture, word, quote', () => {
    const all = times().map((t) => frame(t).cells);
    const firstSeen = all[0].map((c, i) => ({ c, at: all.findIndex((cells) => shown(cells[i]) > 0.01) })).filter(({ c }) => c.phrase === 0);
    const order = firstSeen.sort((a, b) => a.at - b.at).map(({ c }) => c.kind);

    expect(order).toEqual(['text', 'media', 'text', 'media', 'text', 'quote']);
  });

  it('enters monotonically: nothing flickers back while arriving or holding', () => {
    const all = times().map((t) => frame(t).cells);
    all[0].forEach((_, i) => {
      const values = all.map((cells) => shown(cells[i]));
      const peak = values.indexOf(Math.max(...values));
      const rising = values.slice(0, peak + 1);
      rising.slice(1).forEach((v, k) => expect(v).toBeGreaterThanOrEqual(rising[k] - 1e-9));
      const falling = values.slice(values.lastIndexOf(Math.max(...values)));
      falling.slice(1).forEach((v, k) => expect(v).toBeLessThanOrEqual(falling[k] + 1e-9));
    });
  });

  it('moves without jumps: no cell changes by more than a frame-sized step', () => {
    const all = times().map((t) => frame(t).cells);
    for (let f = 1; f < all.length; f++) {
      all[f].forEach((c, i) => expect(Math.abs(shown(c) - shown(all[f - 1][i]))).toBeLessThan(0.35));
    }
  });

  it.each(Object.entries(ASPECTS))('keeps every cell inside the %s frame and words clear of pictures', (_, size) => {
    const [w, h] = size;
    const cells = frame(3, size).cells;
    for (const c of cells) {
      expect(left(c)).toBeGreaterThanOrEqual(-1);
      expect(left(c) + textWidth(c)).toBeLessThanOrEqual(w + 1);
      expect(c.y).toBeGreaterThanOrEqual(-1);
      expect(c.y + c.h).toBeLessThanOrEqual(h + 1);
    }
    for (const phrase of [0, 1, 2]) {
      const mine = cells.filter((c) => c.phrase === phrase);
      for (const a of mine.filter((c) => c.kind === 'text')) {
        for (const b of mine.filter((c) => c.kind === 'media')) {
          const apart = left(a) + textWidth(a) <= b.x || b.x + b.w <= left(a) || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(apart, `${a.text} overlaps a picture`).toBe(true);
        }
      }
    }
  });
});
