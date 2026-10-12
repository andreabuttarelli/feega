import { describe, expect, it } from 'vitest';
import { COMMENTS_MODEL } from './model';

type Comment = { name: string; handle: string; text: string; rating: number; time: string };
type Card = { col: number; index: number; x: number; y: number; h: number; opacity: number; rise: number };
type Word = { y: number; opacity: number };
type Frame = { cards: Card[]; words: Word[]; veil: number; blur: number };
type Size = { width: number; height: number };
type Layout = { cardWidth: number; columns: { x: number; cycle: number[]; period: number }[] };
type Model = {
  parseComments: (raw: string) => Comment[];
  gridColumns: (p: object, size: Size) => { count: number; cardWidth: number; gap: number };
  columnCycles: (comments: number, columns: number) => number[][];
  gridLayout: (p: object, size: Size, heights: number[]) => Layout;
  gridFrame: (layout: Layout, p: object, t: number, length: number, size: Size) => Frame;
};

const model = new Function(`${COMMENTS_MODEL}; return { parseComments, gridColumns, columnCycles, gridLayout, gridFrame };`)() as Model;

const PARAMS = { title: 'loved by thousands', cardWidth: 0.34, gap: 0.022, speed: 0.8, direction: 'up', enterAt: 0, enterSeconds: 1.2, stagger: 1.4, titleAt: 2.8, gridDim: 0.5, gridBlur: 2, leave: true };
const SIZE = { width: 1920, height: 1080 };
const LENGTH = 10;
const FPS = 30;
const COMMENTS = 18;
const HEIGHTS = Array.from({ length: COMMENTS }, (_, i) => 160 + ((i * 47) % 140));
const times = (until = LENGTH) => Array.from({ length: Math.round(until * FPS) + 1 }, (_, i) => i / FPS);
const layout = (p: object = PARAMS) => model.gridLayout(p, SIZE, HEIGHTS);
const frame = (t: number, p: object = PARAMS) => model.gridFrame(layout(p), p, t, LENGTH, SIZE);
const onScreen = (y: number, h: number) => y + h > 0 && y < SIZE.height;
const visible = (f: Frame) => f.cards.filter((c) => onScreen(c.y, c.h));
const signature = (f: Frame) => visible(f).map((c) => `${c.col}:${c.index}:${c.y.toFixed(3)}`).sort();

describe('the comment grid model', () => {
  it('reads one comment per line, name | handle | comment | rating | time', () => {
    const parsed = model.parseComments('Mara Quill | @maraq | Fast and calm. | 5 | 2h\n\n  Theo Brandt|@theo|Love it  \nNo pipes here');

    expect(parsed).toEqual([
      { name: 'Mara Quill', handle: '@maraq', text: 'Fast and calm.', rating: 5, time: '2h' },
      { name: 'Theo Brandt', handle: '@theo', text: 'Love it', rating: 0, time: '' },
      { name: '', handle: '', text: 'No pipes here', rating: 0, time: '' }
    ]);
  });

  it('lays out enough columns to fill the frame edge to edge', () => {
    [SIZE, { width: 1080, height: 1920 }, { width: 1080, height: 1080 }].forEach((size) => {
      const { count, cardWidth, gap } = model.gridColumns(PARAMS, size);
      expect(count * cardWidth + (count - 1) * gap).toBeGreaterThan(size.width);
    });
  });

  it('gives every column distinct comments and uses every comment', () => {
    const cycles = model.columnCycles(COMMENTS, 6);

    cycles.forEach((c) => expect(new Set(c).size).toBe(c.length));
    expect(new Set(cycles.flat()).size).toBe(COMMENTS);
  });

  it('fills the frame top to bottom in every column, at every moment', () => {
    times().filter((_, i) => i % 7 === 0).forEach((t) => {
      const f = frame(t);
      layout().columns.forEach((_, col) => {
        const cards = f.cards.filter((c) => c.col === col);
        expect(Math.min(...cards.map((c) => c.y))).toBeLessThanOrEqual(0);
        expect(Math.max(...cards.map((c) => c.y + c.h))).toBeGreaterThanOrEqual(SIZE.height);
      });
    });
  });

  it('drifts each column at its own steady speed', () => {
    const speeds = layout().columns.map((_, col) => {
      const at = (t: number) => frame(t).cards.filter((c) => c.col === col).sort((a, b) => a.y - b.y)[0];
      return Math.max(at(5.1).y, at(5.2).y) - Math.min(at(5.1).y, at(5.2).y) > SIZE.height / 2 ? null : at(5.2).y - at(5.1).y;
    });
    const steady = speeds.filter((s): s is number => s !== null);

    steady.forEach((s) => expect(s).toBeLessThan(0));
    expect(new Set(steady.map((s) => s.toFixed(1))).size).toBeGreaterThan(1);
  });

  it('wraps every column seamlessly: the loop ends on exactly the grid it started with', () => {
    const still = { ...PARAMS, leave: false };

    expect(signature(frame(LENGTH, still))).toEqual(signature(frame(0, still)));
  });

  it('never jumps a card on screen: wraps happen out of frame', () => {
    const path = times().map((t) => frame(t));
    path.slice(1).forEach((f, k) => {
      f.cards.forEach((c, i) => {
        const before = path[k].cards[i];
        if (Math.abs(c.y - before.y) > SIZE.height / 2) {
          expect(onScreen(c.y, c.h) || onScreen(before.y, c.h)).toBe(false);
        }
      });
    });
  });

  it('enters staggered from the centre outward, each card only moving forward', () => {
    const settled = frame(5).cards;
    const at0 = frame(0).cards;
    const first = (i: number) => times(4).find((t) => frame(t).cards[i].opacity > 0.01)!;
    const ranked = at0
      .map((c, i) => ({ i, d: Math.hypot(c.x + layout().cardWidth / 2 - SIZE.width / 2, c.y + c.h / 2 - SIZE.height / 2) }))
      .filter(({ i }) => onScreen(at0[i].y, at0[i].h) && onScreen(settled[i].y, settled[i].h))
      .sort((a, b) => a.d - b.d);

    expect(at0.every((c) => c.opacity === 0)).toBe(true);
    expect(first(ranked[0].i)).toBeLessThan(first(ranked[ranked.length - 1].i));

    const path = times(4).map((t) => frame(t));
    path.slice(1).forEach((f, k) =>
      f.cards.forEach((c, i) => {
        expect(c.opacity).toBeGreaterThanOrEqual(path[k].cards[i].opacity - 1e-9);
        expect(c.rise).toBeLessThanOrEqual(path[k].cards[i].rise + 1e-9);
      })
    );
  });

  it('brings the title in after the grid, dimming the grid under it', () => {
    const gridIn = times().find((t) => visible(frame(t)).every((c) => c.opacity > 0.99))!;
    const firstWord = times().find((t) => frame(t).words[0].opacity > 0.01)!;

    expect(firstWord).toBeGreaterThan(gridIn - 0.5);
    expect(frame(1).veil).toBe(0);
    expect(frame(6).veil).toBeCloseTo(PARAMS.gridDim, 2);
    expect(frame(6).blur).toBeCloseTo(PARAMS.gridBlur, 2);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 2, 6.4, 9.8];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: the last frame matches the first', () => {
    const first = frame(0);
    const last = frame(LENGTH);

    expect(last.cards.every((c) => c.opacity < 1e-4)).toBe(true);
    first.words.forEach((w, i) => expect(last.words[i].opacity).toBeCloseTo(w.opacity, 4));
    expect(last.veil).toBeCloseTo(first.veil, 4);
    expect(last.blur).toBeCloseTo(first.blur, 4);
  });
});
