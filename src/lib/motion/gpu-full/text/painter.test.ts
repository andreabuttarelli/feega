import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../../components';
import { boxOf } from '../../layout';
import { FillType } from '../../fill/model';
import { apply2d } from '../../affine';
import { paintText, Smoothing, TextGap, type Ink, type TextComponent, type TextEnv } from './painter';
import { boxBook } from './test-face';
import { animatorSchema, AnimatorUnit, SelectorShape } from '../../text-animators/model';

const stage = { width: 1920, height: 1080 };
const FPS = 30;

function env(component: TextComponent, props: Record<string, unknown>, change: Partial<TextEnv> = {}): TextEnv {
  const parsed = COMPONENTS[component].schema.parse(props) as Record<string, unknown>;
  return { component, smoothing: Smoothing.Plain, props: parsed, box: boxOf(parsed as never, stage), stage, colour: (v) => (v.startsWith('#') ? v : '#ffffff'), time: 10, trim: 0, fps: FPS, still: null, fonts: boxBook(), animators: [], ...change };
}

const drawn = (painted: ReturnType<typeof paintText>): Ink[] => {
  if (!Array.isArray(painted)) {
    throw new Error(`gap ${painted}`);
  }
  return painted;
};

function extent(inks: Ink[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const ink of inks) {
    for (const c of ink.contours) {
      for (let i = 0; i < c.length; i += 2) {
        const [x, y] = apply2d(ink.matrix, [c[i], c[i + 1]]);
        xs.push(x);
        ys.push(y);
      }
    }
  }
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

describe('paintText', () => {
  it('centres a line in its box', () => {
    const e = env('Text', { text: 'aa', align: 'center' });
    const ink = extent(drawn(paintText(e)));

    expect((ink.left + ink.right) / 2).toBeCloseTo(e.box.width / 2, 0);
  });

  it('shrinks a title until it fits the safe box', () => {
    const e = env('Title', { text: 'a very long headline that cannot fit', width: 0.5 });
    const ink = extent(drawn(paintText(e)));

    expect(ink.right - ink.left).toBeLessThanOrEqual(e.box.width);
  });

  it('keeps an auto-width text on one line', () => {
    const e = env('Text', { text: 'aa bb cc', sizing: 'auto', width: 0.05 });
    const ink = extent(drawn(paintText(e)));

    expect(ink.bottom - ink.top).toBeLessThan(0.04 * 1080);
  });

  it('hides each title line below its mask until the line rises', () => {
    const e = env('Title', { text: 'a\nb' });

    expect(drawn(paintText({ ...e, time: 0 }))).toEqual([]);
    expect(drawn(paintText({ ...e, time: 1 })).flatMap((i) => i.contours)).toHaveLength(2);
  });

  it('fades body text up from transparent', () => {
    const e = env('Text', { text: 'a' });
    const opacity = (time: number) => drawn(paintText({ ...e, time }))[0]?.opacity ?? 0;

    expect(opacity(0)).toBe(0);
    expect(opacity(9 / FPS)).toBeGreaterThan(0);
    expect(opacity(1)).toBe(1);
  });

  it('upper-cases a kicker before looking its glyphs up', () => {
    const fonts = boxBook(new Set(['a']));

    expect(Array.isArray(paintText(env('Kicker', { text: 'a' }, { fonts })))).toBe(true);
    expect(paintText(env('Text', { text: 'a' }, { fonts }))).toBe(TextGap.Glyph);
  });

  it('draws the caption box under the words in the box colour', () => {
    const inks = drawn(paintText(env('Caption', { text: 'a', background: '#ff0000' })));

    expect(inks[0].color).toEqual([1, 0, 0, 1]);
    expect(inks).toHaveLength(2);
  });

  it('names what it cannot paint yet', () => {
    const gradient = [{ type: FillType.Linear, angle: 0, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] }];

    expect(paintText(env('Text', { fills: gradient }))).toBe(TextGap.Fill);
    expect(paintText(env('Text', { strokes: [{ paint: { type: FillType.Solid, color: '#000000' }, width: 0.01 }] }))).toBe(TextGap.Stroke);
    expect(paintText(env('Text', {}, { fonts: () => null }))).toBe(TextGap.Font);
  });

  it('darkens and lifts glyphs the way a smoothing rasteriser does', () => {
    const plain = extent(drawn(paintText(env('Text', { text: 'a' }))));
    const smooth = extent(drawn(paintText(env('Text', { text: 'a' }, { smoothing: Smoothing.Dilated }))));

    expect(smooth.right - smooth.left).toBeCloseTo(plain.right - plain.left + 0.6);
    expect(smooth.bottom).toBeLessThan(plain.bottom);
  });
  describe('with text animators', () => {
    const animated = (text: string, input: Record<string, unknown>, props: Record<string, unknown> = {}) => {
      const a = animatorSchema.parse({ id: 'a', unit: AnimatorUnit.Char, shape: SelectorShape.Square, ...input });
      return drawn(paintText(env('Text', { text, align: 'left', ...props }, { animators: [a] })));
    };
    const plain = (text: string) => drawn(paintText(env('Text', { text, align: 'left' })));
    const sizeOf = (inks: Ink[]) => (extent(inks).bottom - extent(inks).top) / 0.7;

    it('hides the characters an opacity animator selects', () => {
      const still = extent(plain('ab'));
      const inks = animated('ab', { end: 50, values: { opacity: 0 } });

      expect(inks).toHaveLength(1);
      expect(extent(inks).left).toBeCloseTo(still.left + (still.right - still.left) / 2, 0);
    });

    it('groups glyphs by word for a word animator', () => {
      const inks = animated('ab cd', { unit: AnimatorUnit.Word, end: 50, values: { opacity: 0 } });

      expect(inks.flatMap((i) => i.contours)).toHaveLength(2);
    });

    it('offsets a unit by em of the type size', () => {
      const size = sizeOf(plain('a'));

      expect(extent(animated('a', { values: { y: 1 } })).top - extent(plain('a')).top).toBeCloseTo(size, 0);
    });

    it('turns a unit about the centre of its box', () => {
      const still = extent(plain('a'));
      const size = sizeOf(plain('a'));
      const quarter = extent(animated('a', { values: { rotation: 90 } }));
      const half = extent(animated('a', { values: { rotation: 180 } }));

      expect(quarter.right - quarter.left).toBeCloseTo(0.7 * size, 0);
      expect((half.left + half.right) / 2).toBeCloseTo((still.left + still.right) / 2, 0);
    });

    it('mixes the animator colour into the text colour and blurs the unit', () => {
      const [ink] = animated('a', { values: { color: '#ff0000', blur: 4 } }, { fills: [{ type: FillType.Solid, color: '#0000ff' }] });

      expect(ink.color).toEqual([1, 0, 0, 1]);
      expect(ink.blur).toBe(4);
    });
  });
});
