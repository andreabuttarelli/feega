import { describe, expect, it } from 'vitest';
import { COLLAGE_MODEL } from './model';

type Card = { x: number; y: number; rot: number; scale: number; opacity: number };
type Placed = { x: number; y: number; w: number; h: number; rot: number; print: boolean };
type Layout = { unit: number; cards: Placed[]; cells: { x: number; y: number }[]; lines: number[] };
type Frame = { cards: Card[]; cells: { opacity: number; y: number }[]; lines: number[]; drift: number };
type Model = {
  collageLayout: (p: object, width: number, height: number) => Layout;
  collageFrame: (layout: Layout, p: object, t: number, length: number) => Frame;
  labelRows: (raw: string, count: number) => string[][];
  fitLetters: (text: string, width: number, height: number, cap: number) => Letters;
  LETTER_ADVANCE: number;
  LETTER_LEADING: number;
  LETTER_REACH: number;
};
type Letters = { lines: string[]; size: number; turn: number };

const model = new Function(`${COLLAGE_MODEL}; return { collageLayout, collageFrame, labelRows, fitLetters, LETTER_ADVANCE, LETTER_LEADING, LETTER_REACH };`)() as Model;

const PARAMS = { count: 8, cardScale: 1, cardsAt: 0.3, gap: 0.85, labelsAt: 0.6, settle: 1.5, leave: true };
const LENGTH = 10;
const FPS = 60;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const offFrame = (c: Card, layout: Layout, card: Placed, width: number, height: number) => {
  const reach = (Math.hypot(card.w, card.h) / 2) * c.scale * layout.unit;
  return Math.abs(c.x * layout.unit) - reach >= width / 2 || Math.abs(c.y * layout.unit) - reach >= height / 2;
};

describe('the collage stack model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const layout = model.collageLayout(PARAMS, 1080, 1920);
    const at = [0.4, 3, 7.2, 9.6];
    const forward = at.map((t) => model.collageFrame(layout, PARAMS, t, LENGTH));
    const backward = [...at].reverse().map((t) => model.collageFrame(layout, PARAMS, t, LENGTH)).reverse();

    expect(backward).toEqual(forward);
  });

  it.each(Object.entries(ASPECTS))('closes the loop in %s: first and last frames show no card, label or line', (_, [width, height]) => {
    const layout = model.collageLayout(PARAMS, width, height);

    for (const t of [0, LENGTH]) {
      const f = model.collageFrame(layout, PARAMS, t, LENGTH);
      f.cards.forEach((c, i) => expect(offFrame(c, layout, layout.cards[i], width, height) || c.opacity < 1e-4).toBe(true));
      f.cells.forEach((c) => expect(c.opacity).toBeCloseTo(0, 4));
      f.lines.forEach((l) => expect(l).toBeCloseTo(0, 4));
    }
  });

  it('rotates every card differently, mixing photos and white prints', () => {
    const cards = model.collageLayout(PARAMS, 1080, 1920).cards;

    expect(new Set(cards.map((c) => c.rot)).size).toBe(cards.length);
    expect(cards.some((c) => c.print)).toBe(true);
    expect(cards.some((c) => !c.print)).toBe(true);
  });

  it('builds the stack one card at a time: landed cards only grow until the exit', () => {
    const layout = model.collageLayout(PARAMS, 1080, 1920);
    const landed = (t: number) => model.collageFrame(layout, PARAMS, t, LENGTH).cards.filter((c, i) => Math.hypot(c.x - layout.cards[i].x, c.y - layout.cards[i].y) < 0.01).length;
    const counts = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => landed(t));

    counts.slice(1).forEach((n, i) => expect(n).toBeGreaterThanOrEqual(counts[i]));
    expect(counts.at(-1)).toBe(PARAMS.count);
  });

  it('never overshoots: a card entering only turns towards its resting angle', () => {
    const one = { ...PARAMS, count: 1 };
    const layout = model.collageLayout(one, 1080, 1920);
    const first = layout.cards[0];
    const at = one.cardsAt;
    const rots = times().filter((t) => t >= at && t <= at + 2).map((t) => model.collageFrame(layout, one, t, LENGTH).cards[0].rot);
    const sign = Math.sign(rots.at(-1)! - rots[0]);

    rots.slice(1).forEach((r, i) => expect(Math.sign(r - rots[i]) * sign).toBeGreaterThanOrEqual(0));
    expect(Math.abs(rots.at(-1)! - first.rot)).toBeLessThan(0.5);
  });

  it('keeps turning the same way when later cards nudge the stack', () => {
    const layout = model.collageLayout(PARAMS, 1080, 1920);
    const rots = times().filter((t) => t >= PARAMS.cardsAt && t <= 7.5).map((t) => model.collageFrame(layout, PARAMS, t, LENGTH).cards[0].rot);
    const sign = Math.sign(rots.at(-1)! - rots[0]);

    rots.slice(1).forEach((r, i) => expect(Math.sign(r - rots[i]) * sign).toBeGreaterThanOrEqual(0));
  });

  it.each(Object.entries(ASPECTS))('moves without jumps at 60 fps in %s', (_, [width, height]) => {
    const layout = model.collageLayout(PARAMS, width, height);
    const frames = times().map((t) => model.collageFrame(layout, PARAMS, t, LENGTH));

    frames.slice(1).forEach((f, i) => {
      f.cards.forEach((c, k) => {
        const was = frames[i].cards[k];
        expect(Number.isFinite(c.x + c.y + c.rot + c.scale + c.opacity)).toBe(true);
        expect(Math.hypot(c.x - was.x, c.y - was.y)).toBeLessThan(0.25);
        expect(Math.abs(c.rot - was.rot)).toBeLessThan(4);
      });
    });
  });

  it('labels every cell with a fictional id, creator and saver', () => {
    const rows = model.labelRows('Nadia Orr, @fennel\nUnknown, @loam', 3);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual([expect.stringMatching(/^ID [A-Z0-9/]+$/), 'CREATED BY NADIA ORR', 'SAVED BY @FENNEL']);
    expect(rows[2][1]).toBe('CREATED BY NADIA ORR');
    expect(rows[0][0]).not.toBe(rows[2][0]);
  });

  it('keeps the grid of labels inside the frame in every aspect', () => {
    Object.values(ASPECTS).forEach(([width, height]) => {
      const layout = model.collageLayout(PARAMS, width, height);
      expect(layout.cells.length).toBeGreaterThan(6);
      layout.cells.forEach((c) => {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThan(1);
        expect(c.y).toBeLessThan(1);
      });
    });
  });

  describe('the background lettering', () => {
    const SHORT = 'keep';
    const MEDIUM = 'new season drop';
    const LONG = 'everything we saved this year, from the first sketch to the last print, in one long archive of found pictures';
    const CAP = 92;

    const lineWidth = (line: string, size: number) => line.length * model.LETTER_ADVANCE * size;

    it.each(Object.entries(ASPECTS).flatMap(([aspect, size]) => [SHORT, MEDIUM, LONG].map((text) => [aspect, text, size] as const)))('fits the frame in %s for "%s"', (_, text, [width, height]) => {
      const fit = model.fitLetters(text, width, height, CAP);
      const long = Math.max(width, height);
      const short = Math.min(width, height);

      expect(fit.size).toBeGreaterThan(0);
      expect(fit.size).toBeLessThanOrEqual((short * CAP) / 100);
      expect(fit.lines.length * fit.size * model.LETTER_LEADING).toBeLessThanOrEqual(short + 1e-6);
      fit.lines.forEach((line) => expect(lineWidth(line, fit.size)).toBeLessThanOrEqual(long * model.LETTER_REACH + 1e-6));
      expect(fit.lines.join(' ')).toBe(text);
    });

    it('fills the frame: a long text never leaves the short side mostly empty', () => {
      const fit = model.fitLetters(LONG, 1080, 1920, CAP);

      expect(fit.lines.length).toBeGreaterThan(1);
      expect(fit.lines.length * fit.size * model.LETTER_LEADING).toBeGreaterThan(1080 * 0.5);
    });

    it('sets a short word bigger than a long sentence', () => {
      expect(model.fitLetters(SHORT, 1080, 1920, CAP).size).toBeGreaterThan(model.fitLetters(LONG, 1080, 1920, CAP).size);
    });

    it('runs along the long side: turned in portrait, flat otherwise', () => {
      expect(model.fitLetters(SHORT, 1080, 1920, CAP).turn).toBe(-90);
      expect(model.fitLetters(SHORT, 1920, 1080, CAP).turn).toBe(0);
      expect(model.fitLetters(SHORT, 1080, 1080, CAP).turn).toBe(0);
    });

    it('collapses spaces and survives an empty text', () => {
      expect(model.fitLetters('  a   b  ', 1080, 1920, CAP).lines.join(' ')).toBe('a b');
      expect(model.fitLetters('', 1080, 1920, CAP).lines).toEqual([' ']);
    });
  });
});
