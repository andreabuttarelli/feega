import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../../components';
import { boxOf } from '../../layout';
import { FillType } from '../../fill/model';
import { apply2d } from '../../affine';
import { paintText, Smoothing, TextGap, type Ink, type TextComponent, type TextEnv } from './painter';
import { boxBook } from './test-face';
import { FillRule, PaintKind, type Paint } from '../paint';
import { animatorSchema, AnimatorUnit, SelectorShape } from '../../text-animators/model';

const stage = { width: 1920, height: 1080 };
const FPS = 30;

function env(component: TextComponent, props: Record<string, unknown>, change: Partial<TextEnv> = {}): TextEnv {
  const parsed = COMPONENTS[component].schema.parse(props) as Record<string, unknown>;
  return { component, smoothing: Smoothing.Plain, props: parsed, box: boxOf(parsed as never, stage), stage, colour: (v) => (v.startsWith('#') ? v : '#ffffff'), time: 10, trim: 0, fps: FPS, still: null, fonts: boxBook(), animators: [], asset: () => null, ...change };
}

const drawn = (painted: ReturnType<typeof paintText>): Ink[] => {
  if (typeof painted === 'string') {
    throw new Error(`gap ${painted}`);
  }
  return painted.inks;
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

    expect(typeof paintText(env('Kicker', { text: 'a' }, { fonts }))).toBe('object');
    expect(paintText(env('Text', { text: 'a' }, { fonts }))).toBe(TextGap.Glyph);
  });

  it('draws the caption box under the words in the box colour', () => {
    const inks = drawn(paintText(env('Caption', { text: 'a', background: '#ff0000' })));

    expect(inks[0].paint).toEqual({ kind: PaintKind.Solid, color: [1, 0, 0, 1] });
    expect(inks).toHaveLength(2);
  });

  it('names what it cannot paint yet', () => {
    const tiled = [{ type: FillType.Image, src: 'https://x.test/p.png', fit: 'tile' }];

    expect(paintText(env('Text', { fills: tiled }))).toBe(TextGap.Fill);
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

      expect(ink.paint).toEqual({ kind: PaintKind.Solid, color: [1, 0, 0, 1] });
      expect(ink.blur).toBe(4);
    });
  });
  describe('the box the page renders', () => {
    const frameOf = (component: TextComponent, props: Record<string, unknown>) => {
      const painted = paintText(env(component, props));
      if (typeof painted === 'string') {
        throw new Error(`gap ${painted}`);
      }
      return painted.frame;
    };

    it('is the safe box for a title', () => {
      expect(frameOf('Title', { text: 'a', x: 0.1, width: 0.3, height: 0.2 })).toEqual({ left: 192, top: 0, width: 384, height: 0.2 * 1080 });
    });

    it('is as tall as its lines for auto-height text', () => {
      const frame = frameOf('Text', { text: 'a', sizing: 'auto-height', height: 0.5 });

      expect(frame.top).toBe(0);
      expect(frame.height).toBeLessThan(0.2 * 1080);
    });

    it('is as wide as its line for auto-width text', () => {
      const frame = frameOf('Text', { text: 'a', sizing: 'auto', width: 0.5 });

      expect(frame.width).toBeLessThan(0.1 * 1920);
    });
  });
  describe('strokes and painted fills', () => {
    const red = { type: FillType.Solid, color: '#ff0000' };
    const stops = [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }];
    const inksOf = (component: TextComponent, props: Record<string, unknown>) => drawn(paintText(env(component, { text: 'aa', align: 'left', ...props })));
    const plainInk = (component: TextComponent = 'Text') => extent(inksOf(component, {}));

    it('strokes the outlines on top of the fill, centred on them', () => {
      const inks = inksOf('Text', { strokes: [{ paint: red, width: 0.01 }] });
      const band = extent([inks[1]]);

      expect(inks.map((i) => i.rule)).toEqual([FillRule.NonZero, FillRule.Union]);
      expect(inks[1].paint).toEqual({ kind: PaintKind.Solid, color: [1, 0, 0, 1] });
      expect(band.left).toBeCloseTo(plainInk().left - 0.005 * 1080, 0);
    });

    it('puts an outside stroke under the fill at twice the width', () => {
      const inks = inksOf('Text', { strokes: [{ paint: red, width: 0.01, align: 'outside' }] });

      expect(inks.map((i) => i.rule)).toEqual([FillRule.Union, FillRule.NonZero]);
      expect(extent([inks[0]]).left).toBeCloseTo(plainInk().left - 0.01 * 1080, 0);
    });

    it('spreads a linear gradient over the line box of inline text, like background-clip text', () => {
      const [ink] = inksOf('Text', { fills: [{ type: FillType.Linear, angle: 0, stops }] });
      const paint = ink.paint as Extract<Paint, { kind: PaintKind.Linear }>;
      const [from] = apply2d(ink.matrix, paint.from);
      const [to] = apply2d(ink.matrix, paint.to);

      expect(from).toBeCloseTo(plainInk().left, 0);
      expect(to).toBeCloseTo(plainInk().right, 0);
    });

    it('spreads a title gradient down each line block', () => {
      const e = env('Title', { text: 'aa', fills: [{ type: FillType.Linear, angle: 90, stops }] });
      const [ink] = drawn(paintText(e));
      const paint = ink.paint as Extract<Paint, { kind: PaintKind.Linear }>;

      expect(paint.from[0]).toBeCloseTo(paint.to[0]);
      expect(paint.to[1]).toBeGreaterThan(paint.from[1]);
    });

    it('draws a radial fill as an ellipse without moving the glyphs', () => {
      const [ink] = inksOf('Text', { fills: [{ type: FillType.Radial, center: { x: 0.5, y: 0.5 }, radius: 1, stops }] });
      const drawnAt = extent([ink]);

      expect(ink.paint.kind).toBe(PaintKind.Radial);
      expect(drawnAt.left).toBeCloseTo(plainInk().left);
      expect(drawnAt.bottom).toBeCloseTo(plainInk().bottom);
    });

    it('stacks fills bottom first and fades each by its opacity', () => {
      const inks = inksOf('Text', { fills: [red, { type: FillType.Solid, color: '#0000ff', opacity: 0.5 }] });

      expect(inks.map((i) => i.paint)).toEqual([
        { kind: PaintKind.Solid, color: [1, 0, 0, 1] },
        { kind: PaintKind.Solid, color: [0, 0, 1, 0.5] }
      ]);
    });
  });
  describe('the rest of the fills', () => {
    const stops = [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }];
    const inksOf = (props: Record<string, unknown>, change: Partial<TextEnv> = {}) => drawn(paintText(env('Text', { text: 'aa', align: 'left', ...props }, change)));
    const solid = (color: string, blend = 'normal') => ({ type: FillType.Solid, color, blend });

    it('draws a diamond as four linear quadrants meeting at the centre', () => {
      const inks = inksOf({ fills: [{ type: FillType.Diamond, stops }] });

      expect(inks).toHaveLength(4);
      expect(inks.every((i) => i.paint.kind === PaintKind.Linear)).toBe(true);
    });

    it('draws an angular gradient as thin wedges, black just after where it starts', () => {
      const inks = inksOf({ fills: [{ type: FillType.Angular, angle: 0, center: { x: 0.5, y: 0.5 }, stops }] });
      const first = inks[0].paint as Extract<Paint, { kind: PaintKind.Linear }>;

      expect(inks.length).toBeGreaterThan(8);
      expect(first.stops[0].color[0]).toBeLessThan(0.05);
    });

    it('blends solid layers into one colour like background-blend-mode', () => {
      const [multiplied] = inksOf({ fills: [solid('#ffffff'), solid('#ff0000', 'multiply')] });
      const [screened] = inksOf({ fills: [solid('#808080'), solid('#808080', 'screen')] });

      expect(multiplied.paint).toEqual({ kind: PaintKind.Solid, color: [1, 0, 0, 1] });
      expect((screened.paint as Extract<Paint, { kind: PaintKind.Solid }>).color[0]).toBeCloseTo(0.749, 2);
    });

    it('still names a blended gradient', () => {
      expect(paintText(env('Text', { fills: [solid('#ffffff'), { type: FillType.Linear, angle: 0, stops, blend: 'multiply' }] }))).toBe(TextGap.Fill);
    });

    it('shows an image through the glyphs', () => {
      const [ink] = inksOf({ fills: [{ type: FillType.Image, assetId: 'pic', fit: 'contain' }] }, { asset: (id) => (id === 'pic' ? 'https://x.test/p.png' : null) });

      expect(ink.picture).toMatchObject({ src: 'https://x.test/p.png', fit: 'contain' });
      expect(ink.contours.length).toBeGreaterThan(0);
    });

    it('paints a gradient through units a colour animator touches', () => {
      const a = animatorSchema.parse({ id: 'a', unit: AnimatorUnit.Char, values: { color: '#ff0000' } });

      expect(inksOf({ fills: [{ type: FillType.Linear, angle: 0, stops }] }, { animators: [a] }).map((i) => i.paint.kind)).toEqual([PaintKind.Linear, PaintKind.Linear]);
    });

    it('hides gradient text in units the page isolates, as background-clip text skips them', () => {
      const moved = animatorSchema.parse({ id: 'a', unit: AnimatorUnit.Char, values: { y: 0.2 } });
      const faded = animatorSchema.parse({ id: 'b', unit: AnimatorUnit.Char, shape: SelectorShape.Square, end: 50, values: { opacity: 0.5 } });
      const gradient = { fills: [{ type: FillType.Linear, angle: 0, stops }] };

      expect(inksOf(gradient, { animators: [moved] })).toEqual([]);
      expect(inksOf(gradient, { animators: [faded] })).toHaveLength(1);
    });
  });
});
