import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { Ease, TransitionKind } from '../design';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { FillType } from '../fill/model';
import { BlendMode } from '../blend';
import { displayListAt, drawFrame, FillRule, ItemKind, PaintKind, prepare, Unsupported, type ImageItem, type PathItem } from './display-list';
import { apply2d } from '../affine';
import { boxBook } from './text/test-face';
import { Smoothing } from './text/painter';
import { addAnimator } from '../text-animators/ops';
import { setTextPath } from '../text-path/ops';
import { PathPreset, PathSourceKind } from '../text-path/model';
import { SelectorShape } from '../text-animators/model';

const boxType = { fonts: boxBook(), smoothing: Smoothing.Plain };

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const blank = newMotionDoc(MotionFormat.Landscape);
const withBg = must(addClip(blank, { component: 'BrandBackground', from: 0, durationInFrames: 90 }, 'bg'));
const square = { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1, fill: '#ff0000' };
const withCard = must(addClip(withBg, { component: 'Shape', from: 0, durationInFrames: 90, props: square }, 'card'));

const cardProps = withCard.tracks.flatMap((t) => t.clips).find((c) => c.id === 'card')!.props;
const patch = (doc: MotionDoc, id: string, change: Partial<MotionClip>): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...change } : c)) })) });
const list = (doc: MotionDoc, frame = 0) => displayListAt(doc, frame, FEEGA_TOKENS);
const pathOf = (doc: MotionDoc, clip: string, frame = 0) => list(doc, frame).items.find((i): i is PathItem => i.kind === ItemKind.Path && i.clip === clip);
const corners = (item: PathItem | undefined) => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const contour of item?.contours ?? []) {
    for (let i = 0; i < contour.length; i += 2) {
      const [x, y] = apply2d(item!.matrix, [contour[i], contour[i + 1]]);
      xs.push(x);
      ys.push(y);
    }
  }
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
};

describe('displayListAt', () => {
  it('paints the brand background as a full-frame rectangle in the token colour', () => {
    const bg = pathOf(withBg, 'bg');

    expect(corners(bg)).toEqual({ left: 0, top: 0, right: 1920, bottom: 1080 });
    expect(bg?.paint).toEqual({ kind: PaintKind.Solid, color: [0x0a / 255, 0x0a / 255, 0x0a / 255, 1].map((v) => expect.closeTo(v, 2)) });
  });

  it('places a rectangle shape in its box, in frame pixels', () => {
    expect(corners(pathOf(withCard, 'card'))).toEqual({ left: 864, top: 486, right: 1056, bottom: 594 });
  });

  it('moves a shape with its keyframed offset', () => {
    const moving = must(setKeyframes(withCard, 'card', 'x', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 60, value: 0.25, ease: Ease.Linear }]));

    expect(corners(pathOf(moving, 'card', 60)).left).toBeCloseTo(864 + 480);
  });

  it('multiplies the clip opacity into the item', () => {
    const faded = patch(withCard, 'card', { transform: { opacity: 0.5 }, props: { ...cardProps, opacity: 0.5 } });

    expect(pathOf(faded, 'card')?.opacity).toBeCloseTo(0.25);
  });

  it('leaves out a clip outside its time window', () => {
    const late = patch(withCard, 'card', { from: 30 });

    expect(pathOf(late, 'card', 10)).toBeUndefined();
    expect(pathOf(late, 'card', 30)).toBeDefined();
  });

  it('paints the top track last', () => {
    const order = list(withCard).items.map((i) => i.clip);

    expect(order.indexOf('bg')).toBeLessThan(order.indexOf('card'));
  });

  it('maps a linear gradient to the same end points as the HTML engine', () => {
    const fills = [{ type: FillType.Linear, angle: 0, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] }];
    const graded = patch(withCard, 'card', { props: { ...cardProps, fills } });

    expect(pathOf(graded, 'card')?.paint).toMatchObject({ kind: PaintKind.Linear, from: [0, 54], to: [192, 54] });
  });

  it('reads a gaussian blur effect as a CSS blur filter', () => {
    const blurred = patch(withCard, 'card', { effects: [{ id: 'e1', kind: 'gaussian-blur', enabled: true, params: { radius: 12 } }] } as never);

    expect(pathOf(blurred, 'card')?.filters).toEqual([{ kind: 'css', fns: [{ name: 'blur', args: ['12px'] }] }]);
  });

  it('strokes a shape as a union band in its paint, clipped to the shape when inside', () => {
    const strokes = [{ paint: { type: FillType.Solid, color: '#ffffff' }, width: 0.01, align: 'inside' }];
    const stroked = patch(withCard, 'card', { props: { ...cardProps, strokes } });
    const band = list(stroked).items.filter((i): i is PathItem => i.kind === ItemKind.Path && i.clip === 'card')[1];

    expect(band).toMatchObject({ rule: FillRule.Union, paint: { kind: PaintKind.Solid, color: [1, 1, 1, 1] }, within: { outside: false } });
    expect(corners(band).right - corners(band).left).toBeCloseTo(192 + 21.6);
  });

  it('plays an entrance transition on the whole layer', () => {
    const sliding = patch(withCard, 'card', { transitionIn: { kind: TransitionKind.SlideUp, durationInFrames: 10 } });

    expect(corners(pathOf(sliding, 'card', 0)).top).toBeCloseTo(486 + 0.12 * 1080);
    expect(pathOf(sliding, 'card', 0)?.opacity).toBe(0);
  });

  it('wipes with a frame-space scissor', () => {
    const wiping = patch(withCard, 'card', { transitionIn: { kind: TransitionKind.Wipe, durationInFrames: 10 } });

    expect(pathOf(wiping, 'card', 0)?.scissor).toEqual([0, 0, 0, 1080]);
    expect(pathOf(wiping, 'card', 10)?.scissor).toBeUndefined();
  });

  it('carries the clip blend mode to its items', () => {
    const multiplied = patch(withCard, 'card', { blend: BlendMode.Multiply });

    expect(pathOf(multiplied, 'card')?.blend).toBe(BlendMode.Multiply);
    expect(pathOf(withCard, 'card')?.blend).toBe(BlendMode.Normal);
  });

  it('names what it cannot draw yet instead of drawing it wrong', () => {
    const titled = must(addClip(withCard, { component: 'Title', from: 0, durationInFrames: 90 }, 'title'));
    const shadowed = patch(titled, 'card', { blend: BlendMode.Multiply, effects: [{ id: 'e1', kind: 'lut', enabled: true, params: {} }], mask: { kind: 'text', text: 'x' } } as never as never);
    const drawn = list(shadowed);

    expect(drawn.unsupported).toContainEqual({ clip: 'title', component: 'Title', reason: Unsupported.Font });
    expect(drawn.unsupported).toContainEqual({ clip: 'card', component: 'Shape', reason: Unsupported.Mask });
    expect(drawn.items.map((i) => i.clip)).toEqual(['bg']);
  });

  it('draws text clips as glyph outlines once fonts are loaded', () => {
    const titled = must(addClip(withBg, { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'ab' } }, 'title'));
    const glyphs = displayListAt(titled, 60, FEEGA_TOKENS, boxType).items.filter((i): i is PathItem => i.kind === ItemKind.Path && i.clip === 'title');

    expect(glyphs.flatMap((i) => i.contours)).toHaveLength(2);
  });

  it('draws a text bent along a path, one character at a time', () => {
    const texted = must(addClip(withBg, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'abc' } }, 'text'));
    const bent = must(setTextPath(texted, 'text', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Circle } }));
    const drawn = displayListAt(bent, 0, FEEGA_TOKENS, boxType);

    expect(drawn.unsupported).toEqual([]);
    expect(drawn.items.filter((i): i is PathItem => i.kind === ItemKind.Path && i.clip === 'text').flatMap((i) => i.contours)).toHaveLength(3);
  });
  it('turns a title about the centre of its safe box, as the page does', () => {
    const centre = (rotation: number) => {
      const titled = must(addClip(withBg, { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'ab', align: 'left', x: 0.1, width: 0.3, rotation } }, 'title'));
      const ink = corners(displayListAt(titled, 60, FEEGA_TOKENS, boxType).items.find((i): i is PathItem => i.kind === ItemKind.Path && i.clip === 'title'));
      return (ink.left + ink.right) / 2;
    };

    expect((centre(0) + centre(180)) / 2).toBeCloseTo(288, 0);
  });

  it('shows an image fill through the glyphs as a matted picture', () => {
    const texted = must(addClip(withBg, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'ab', fills: [{ type: 'image', assetId: 'pic' }] } }, 'text'));
    const picture = drawFrame(prepare(texted, FEEGA_TOKENS, { pic: 'https://x.test/p.png' }, boxType), 60).items.find((i): i is ImageItem => i.kind === ItemKind.Image && i.clip === 'text');

    expect(picture?.src).toBe('https://x.test/p.png');
    expect(picture?.matte?.items.flatMap((i) => (i.kind === ItemKind.Path ? i.contours : []))).toHaveLength(2);
  });

  it('keeps fills the native core cannot read on the JS painter, never in a text plan', () => {
    const native = { ...boxType, native: { rules: [], registry: [] } };
    const fill = (fills: unknown[]) => must(addClip(withBg, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'ab', fills } }, 'text'));
    const kinds = (doc: MotionDoc) => drawFrame(prepare(doc, FEEGA_TOKENS, {}, native), 60).items.filter((i) => i.clip === 'text').map((i) => i.kind);
    const stops = [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }];

    expect(kinds(fill([{ type: 'linear-gradient', angle: 0, stops }]))).toEqual([ItemKind.Text]);
    expect(new Set(kinds(fill([{ type: 'diamond-gradient', stops }])))).toEqual(new Set([ItemKind.Path]));
    expect(new Set(kinds(fill([{ type: 'angular-gradient', stops }])))).toEqual(new Set([ItemKind.Path]));
  });

  describe('text animators', () => {
    const texted = must(addClip(withBg, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'ab' } }, 'text'));
    const animated = (values: Record<string, number>) => must(addAnimator(texted, 'text', 'a', { shape: SelectorShape.Square, start: 0, end: 0, values }));
    const glyphsAt = (doc: MotionDoc, frame: number) => displayListAt(doc, frame, FEEGA_TOKENS, boxType).items.filter((i): i is PathItem => i.kind === ItemKind.Path && i.clip === 'text');

    it('samples keyframed selector fields per frame', () => {
      const swept = must(setKeyframes(animated({ opacity: 0 }), 'text', 'ta.a.end', [{ frame: 20, value: 0, ease: Ease.Linear }, { frame: 80, value: 100, ease: Ease.Linear }]));

      expect(glyphsAt(swept, 20).flatMap((i) => i.contours)).toHaveLength(2);
      expect(glyphsAt(swept, 50).flatMap((i) => i.contours)).toHaveLength(1);
      expect(glyphsAt(swept, 80)).toHaveLength(0);
    });

    it('blurs a unit by its animator blur', () => {
      const blurred = must(addAnimator(texted, 'text', 'a', { values: { blur: 4 } }));

      expect(glyphsAt(blurred, 60).map((i) => i.blur)).toEqual([4, 4]);
    });

    it('still names a tracking animator', () => {
      expect(displayListAt(animated({ tracking: 0.1 }), 60, FEEGA_TOKENS, boxType).unsupported).toContainEqual({ clip: 'text', component: 'Text', reason: Unsupported.Animator });
    });
  });
});
