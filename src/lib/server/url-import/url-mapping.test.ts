import { describe, expect, it } from 'vitest';
import { DESIGN_MAX_SIDE, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { imagesFilled } from '$lib/canvas/figma/images';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { withStacking } from '@feega/motion-core/motion/layout/stacking';
import { flattenComps } from '@feega/motion-core/motion/precomp';
import { withoutHidden } from '@feega/motion-core/motion/organize';
import { apply2d, pivotBox, worldAt } from '@feega/motion-core/motion/parent';
import type { RestNode, RestPaint } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { fontsWanted, urlPlan } from './url-doc';

const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

let ids = 0;
const id = () => `n${++ids}`;

const pageOf = (children: RestNode[], size = { width: 1280, height: 800 }): PageTree => ({
  title: 'Page',
  url: 'https://example.com/',
  ...size,
  truncated: false,
  root: { id: id(), type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, ...size }, fills: [{ type: 'SOLID', color: WHITE }], children }
});

const rect = (fills: RestPaint[], box = { x: 100, y: 100, width: 400, height: 100 }, extra: Partial<RestNode> = {}): RestNode => ({ id: id(), type: 'RECTANGLE', absoluteBoundingBox: box, fills, ...extra });

const text = (characters: string, extra: Partial<RestNode> = {}): RestNode => ({ id: id(), type: 'TEXT', characters, absoluteBoundingBox: { x: 40, y: 40, width: 200, height: 24 }, fills: [{ type: 'SOLID', color: BLACK }], style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightUnit: 'PIXELS', lineHeightPx: 24 }, ...extra });

const docOf = (tree: PageTree) => {
  let n = 0;
  return urlPlan(tree, () => `c${++n}`)!.plan.items[0].doc;
};

const clipsOf = (doc: MotionDoc): MotionClip[] => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips) as MotionClip[];

const fillsOf = (doc: MotionDoc) => clipsOf(doc).flatMap((c) => (c.props.fills as Record<string, unknown>[] | undefined) ?? []);

const linear = (handles: { x: number; y: number }[], stops: [number, { r: number; g: number; b: number; a: number }][]): RestPaint => ({ type: 'GRADIENT_LINEAR', gradientHandlePositions: handles, gradientStops: stops.map(([position, color]) => ({ position, color })) });

describe('a page becomes a frame that looks like the page', () => {
  it('a page taller than a video keeps its full height at its own width', () => {
    const doc = docOf(pageOf([rect([{ type: 'SOLID', color: BLACK }], { x: 0, y: 8_500, width: 1280, height: 400 })], { width: 1280, height: 9_000 }));

    expect(doc.width).toBeGreaterThanOrEqual(1280);
    expect(doc.height / doc.width).toBeCloseTo(9_000 / 1280, 2);
    expect(clipsOf(doc).some((c) => c.component === 'Shape')).toBe(true);
  });

  it('a page taller than one frame holds becomes frames stacked in page order, each cut where the next starts', () => {
    const tall = DESIGN_MAX_SIDE + 3_616;
    const across = rect([{ type: 'SOLID', color: BLACK }], { x: 0, y: DESIGN_MAX_SIDE - 100, width: 1280, height: 200 });
    const tree = pageOf([text('Top'), across, text('Bottom', { absoluteBoundingBox: { x: 40, y: tall - 100, width: 200, height: 24 } })], { width: 1280, height: tall });
    let n = 0;
    const items = urlPlan(tree, () => `c${++n}`)!.plan.items;
    const texts = items.map((item) => clipsOf(item.doc).flatMap((c) => (typeof c.props.text === 'string' ? [c.props.text] : [])));
    const shapes = items.map((item) => clipsOf(item.doc).filter((c) => c.component === 'Shape' && c.name !== 'Page').length);

    expect(items.map((i) => i.size)).toEqual([
      { width: 1280, height: DESIGN_MAX_SIDE },
      { width: 1280, height: 3_616 }
    ]);
    expect(items[1].centre.y - items[0].centre.y).toBe((DESIGN_MAX_SIDE + 3_616) / 2);
    expect(texts).toEqual([['Top'], ['Bottom']]);
    expect(shapes.every((s) => s >= 1)).toBe(true);
  });

  it('a picture half outside the left edge of the page stays, cut at the edge and anchored to it', () => {
    const tree = pageOf([rect([{ type: 'IMAGE', imageRef: 'https://example.com/card.png', scaleMode: 'FILL' }], { x: -139, y: 100, width: 248, height: 165 })]);
    let n = 0;
    const made = urlPlan(tree, () => `c${++n}`)!;
    const item = made.plan.items[0];
    const doc = imagesFilled(item.doc, item.images, Object.fromEntries(Object.keys(made.images).map((k) => [k, 'asset-1'])));
    const image = fillsOf(doc).find((f) => f.type === 'image') as { focus: { x: number } } | undefined;

    expect(image?.focus.x).toBe(1);
  });

  it('a one pixel rule on a long page stays one pixel thin', () => {
    const height = 14_535;
    const rule = rect([{ type: 'SOLID', color: BLACK }], { x: 0, y: 692, width: 1280, height: 1 });
    const doc = docOf(pageOf([rule], { width: 1280, height }));
    const clip = clipsOf(doc).find((c) => c.component === 'Shape' && Number(c.props.height) < 0.5)!;

    expect(Number(clip.props.height) * height).toBeLessThan(1.5);
  });

  it('a gradient stop that fades out keeps its transparency', () => {
    const doc = docOf(pageOf([rect([linear([{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 0 }], [[0, { ...WHITE, a: 0 }], [1, WHITE]])])]));
    const stops = fillsOf(doc).find((f) => f.type === 'linear-gradient')?.stops as { color: string }[];

    expect(stops[0].color).toBe('#ffffff00');
    expect(stops[1].color).toBe('#ffffff');
  });

  it('a diagonal gradient on a wide box keeps the angle it has on the page', () => {
    const [w, h] = [400, 100];
    const css = 135;
    const rad = (css * Math.PI) / 180;
    const length = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
    const [dx, dy] = [(Math.sin(rad) * length) / 2, (-Math.cos(rad) * length) / 2];
    const handles = [
      { x: (w / 2 - dx) / w, y: (h / 2 - dy) / h },
      { x: (w / 2 + dx) / w, y: (h / 2 + dy) / h },
      { x: 0, y: 1 }
    ];
    const doc = docOf(pageOf([rect([linear(handles, [[0, BLACK], [1, WHITE]])], { x: 0, y: 0, width: w, height: h })]));

    expect(fillsOf(doc).find((f) => f.type === 'linear-gradient')?.angle).toBe(css - 90);
  });

  it('a radial glow keeps where its centre is and how far it reaches', () => {
    const radial: RestPaint = { type: 'GRADIENT_RADIAL', gradientHandlePositions: [{ x: 0.25, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.25, y: 1 }], gradientStops: [{ position: 0, color: WHITE }, { position: 1, color: { ...WHITE, a: 0 } }] };
    const doc = docOf(pageOf([rect([radial], { x: 0, y: 0, width: 400, height: 100 })]));
    const fill = fillsOf(doc).find((f) => f.type === 'radial-gradient') as { center: { x: number; y: number }; radius: number };

    expect(fill.center).toEqual({ x: 0.25, y: 0.5 });
    expect(fill.radius).toBeCloseTo((2 * Math.sqrt(100 * 50)) / 400, 2);
  });

  it('a gradient with more stops than a fill holds keeps its ends', () => {
    const stops: [number, typeof BLACK][] = Array.from({ length: 12 }, (_, i) => [i / 11, i % 2 ? BLACK : WHITE]);
    const doc = docOf(pageOf([rect([linear([{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }], stops)])]));
    const kept = fillsOf(doc).find((f) => f.type === 'linear-gradient')?.stops as { pos: number }[];

    expect(kept.length).toBeLessThanOrEqual(8);
    expect(kept[0].pos).toBe(0);
    expect(kept[kept.length - 1].pos).toBe(1);
  });

  it('see-through text keeps its transparency', () => {
    const doc = docOf(pageOf([text('Muted', { fills: [{ type: 'SOLID', color: { ...BLACK, a: 0.6 } }] })]));
    const clip = clipsOf(doc).find((c) => c.props.text === 'Muted')!;
    const fills = clip.props.fills as { opacity: number }[] | undefined;

    expect(fills?.[0]?.opacity ?? clip.props.opacity).toBeCloseTo(0.6, 2);
  });

  it('line height and letter spacing in pixels scale with the frame like the text size', () => {
    const doc = docOf(pageOf([text('Spaced', { style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, letterSpacing: -0.5, lineHeightUnit: 'PIXELS', lineHeightPx: 24 } })]));
    const clip = clipsOf(doc).find((c) => c.props.text === 'Spaced')!;
    const k = doc.width / 1280;

    expect(parseFloat(String(clip.props.lineHeight))).toBeCloseTo(24 * k, 1);
    expect(parseFloat(String(clip.props.letterSpacing))).toBeCloseTo(-0.5 * k, 1);
  });

  it('variable font axes and OpenType features of the page reach the text', () => {
    const doc = docOf(pageOf([text('Tuned', { style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, fontAxes: "'opsz' 16", fontFeatures: "'cv11' 1, 'ss01' 1" } })]));
    const clip = clipsOf(doc).find((c) => c.props.text === 'Tuned')!;

    expect(clip.props.axes).toBe("'opsz' 16");
    expect(clip.props.features).toBe("'cv11' 1, 'ss01' 1");
  });

  it('underlined text stays underlined', () => {
    const doc = docOf(pageOf([text('Read more', { style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, textDecoration: 'UNDERLINE' } })]));

    expect(clipsOf(doc).find((c) => c.props.text === 'Read more')?.props.decoration).toBe('underline');
  });

  it('a picture shown whole inside its box stays whole, anchored where the page put it', () => {
    const tree = pageOf([rect([{ type: 'IMAGE', imageRef: 'https://example.com/a.png', scaleMode: 'FIT', imageFocus: { x: 0, y: 1 } }])]);
    let n = 0;
    const made = urlPlan(tree, () => `c${++n}`)!;
    const item = made.plan.items[0];
    const doc = imagesFilled(item.doc, item.images, Object.fromEntries(Object.keys(made.images).map((k) => [k, 'asset-1'])));
    const image = fillsOf(doc).find((f) => f.type === 'image') as { fit: string; focus: { x: number; y: number } };

    expect(image.fit).toBe('contain');
    expect(image.focus).toEqual({ x: 0, y: 1 });
  });

  it('a faded group without paint stays faded', () => {
    const group: RestNode = { id: id(), type: 'GROUP', opacity: 0.4, absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, children: [text('One'), rect([{ type: 'SOLID', color: BLACK }])] };
    const doc = docOf(pageOf([group]));
    const faded = clipsOf(doc).filter((c) => c.transform?.opacity === 0.4);

    expect(faded).toHaveLength(1);
  });
});

function textAt(tree: PageTree, characters: string) {
  const doc = docOf(tree);
  const flat = flattenComps(withStacking(withAutoLayout(withoutHidden(doc))));
  const size = { width: flat.width, height: flat.height };
  const clip = flat.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.props.text === characters)!;
  const b = pivotBox(clip.props, size);
  const [x, y] = apply2d(worldAt(flat, clip.id, 0, size), [b.left, b.top]);
  const k = flat.width / tree.width;
  return { x: x / k, y: y / k, width: b.width / k };
}

describe('auto layout never moves what it holds', () => {
  it('a wrapping paragraph centred in a column keeps its width and place', () => {
    const paragraph = text('Built for the future. Available today.', { absoluteBoundingBox: { x: 440, y: 40, width: 400, height: 48 }, textAutoResize: 'HEIGHT', style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, textAlignHorizontal: 'CENTER', lineHeightUnit: 'PIXELS', lineHeightPx: 24 } });
    const column: RestNode = { id: id(), type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 128 }, fills: [], layoutMode: 'VERTICAL', paddingTop: 40, primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'CENTER', primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED', children: [paragraph] };
    const at = textAt(pageOf([column]), 'Built for the future. Available today.');

    expect(at.x).toBeCloseTo(440, 0);
    expect(at.width).toBeCloseTo(400, 0);
  });
});

describe('a fixed-size text keeps its box in a stack', () => {
  it('a text sized NONE in a row keeps its width, and the next text stays where it was', () => {
    const style = { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, textAlignHorizontal: 'LEFT', lineHeightUnit: 'PIXELS', lineHeightPx: 24 };
    const first = text('Docs', { absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 24 }, textAutoResize: 'NONE', style });
    const second = text('Pricing', { absoluteBoundingBox: { x: 140, y: 0, width: 120, height: 24 }, textAutoResize: 'NONE', style });
    const row: RestNode = { id: id(), type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 24 }, fills: [], layoutMode: 'HORIZONTAL', itemSpacing: 20, primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN', primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED', children: [first, second] };
    const tree = pageOf([row]);

    expect(textAt(tree, 'Docs').width).toBeCloseTo(120, 0);
    expect(textAt(tree, 'Pricing').x).toBeCloseTo(140, 0);
  });
});

describe('one-line texts in a column keep their lines', () => {
  it('two hugging lines 24px apart stay 24px apart', () => {
    const style = { fontFamily: 'Inter Variable', fontSize: 15, fontWeight: 400, textAlignHorizontal: 'LEFT', letterSpacing: -0.165, fontAxes: "'opsz' 15", lineHeightUnit: 'PIXELS', lineHeightPx: 24 };
    const line = (y: number, words: string) => text(words, { absoluteBoundingBox: { x: 0, y, width: 320, height: 24 }, textAutoResize: 'WIDTH_AND_HEIGHT', style });
    const column: RestNode = { id: id(), type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 360, height: 48 }, fills: [], layoutMode: 'VERTICAL', itemSpacing: 0, primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN', primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED', children: [line(0, 'Loops automate product work by responding to'), line(24, 'changes in Linear and connected tools. You can')] };

    expect(textAt(pageOf([column]), 'changes in Linear and connected tools. You can').y).toBeCloseTo(24, 0);
  });
});

describe('a fixed text one line tall never wraps', () => {
  it('a one-line text sized NONE comes in without wrapping, a taller one keeps wrapping', () => {
    const style = { fontFamily: 'Inter', fontSize: 15, fontWeight: 400, textAlignHorizontal: 'LEFT', lineHeightUnit: 'PIXELS', lineHeightPx: 24 };
    const doc = docOf(pageOf([text('sync when minimum', { absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 24 }, textAutoResize: 'NONE', style }), text('a paragraph over lines', { absoluteBoundingBox: { x: 140, y: 0, width: 120, height: 48 }, textAutoResize: 'NONE', style })]));
    const wrapOf = (t: string) => clipsOf(doc).find((c) => c.props.text === t)?.props.textWrap;

    expect(wrapOf('sync when minimum')).toBe('none');
    expect(wrapOf('a paragraph over lines')).not.toBe('none');
  });
});

describe('a frame in a stack keeps its own box', () => {
  it('a column whose text runs past its box does not push the next column', () => {
    const style = { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, textAlignHorizontal: 'LEFT', lineHeightUnit: 'PIXELS', lineHeightPx: 24 };
    const column = (x: number, words: string): RestNode => ({ id: id(), type: 'FRAME', absoluteBoundingBox: { x, y: 0, width: 100, height: 48 }, fills: [], children: [text(words, { absoluteBoundingBox: { x, y: 0, width: 160, height: 24 }, style }), text('second line', { absoluteBoundingBox: { x, y: 24, width: 80, height: 24 }, style: { ...style, fontWeight: 700 } })] });
    const row: RestNode = { id: id(), type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 48 }, fills: [], layoutMode: 'HORIZONTAL', itemSpacing: 20, primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN', primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED', children: [column(0, 'A rather long label'), column(120, 'Next')] };

    expect(textAt(pageOf([row]), 'Next').x).toBeCloseTo(120, 0);
  });
});

describe('what the page hides stays hidden', () => {
  it('a frame that clips its content without painting anything still clips it', async () => {
    const { composeHtml } = await import('@feega/motion-core/motion/hyperframes/compose');
    const { FEEGA_TOKENS } = await import('@feega/motion-core/motion/brand');
    const hidden = text('Hidden copy', { absoluteBoundingBox: { x: 100, y: 120, width: 93, height: 19 } });
    const clipper: RestNode = { id: id(), type: 'FRAME', absoluteBoundingBox: { x: 100, y: 100, width: 93, height: 19 }, fills: [], clipsContent: true, children: [text('Shown copy', { absoluteBoundingBox: { x: 100, y: 100, width: 93, height: 19 } }), hidden] };
    const doc = docOf(pageOf([clipper]));
    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });
    const clip = clipsOf(doc).find((c) => c.props.text === 'Hidden copy')!;
    const layer = html.match(new RegExp(`id="c-[^"]*${clip.id}"[^>]*style="([^"]*)"`))?.[1] ?? '';

    expect(layer).toContain('clip-path');
  });
});

describe('the page fonts come along', () => {
  const FACE = { family: 'Acme Sans', weight: '100 900', style: 'normal', url: 'https://example.com/acme.woff2' };

  const withFont = (style: NonNullable<RestNode['style']>): PageTree => ({ ...pageOf([text('Acme', { style })]), fonts: [FACE] });

  it('a font that Google does not have is embedded from the page and the text keeps it', () => {
    const tree = withFont({ fontFamily: 'Acme Sans', fontSize: 16, fontWeight: 510 });
    let n = 0;
    const doc = urlPlan(tree, () => `c${++n}`, undefined, { [FACE.url]: 'font-1' })!.plan.items[0].doc;
    const clip = clipsOf(doc).find((c) => c.props.text === 'Acme')!;
    const face = doc.fonts.find((f) => f.family === 'Acme Sans');

    expect(clip.props.font).toBe('Acme Sans');
    expect(clip.props.weight).toBe(510);
    expect(face?.variants).toEqual([{ assetId: 'font-1', weight: 510, italic: false }]);
  });

  it.each([
    ['-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 'Inter'],
    ['Menlo, Consolas, monospace', 'JetBrains Mono'],
    ['Georgia, serif', 'Gelasio'],
    ['"Merriweather", Georgia, serif', 'Merriweather'],
    ['Helvetica Neue, Arial, sans-serif', 'Arimo']
  ])('a font stack the page leaves to the system, %s, lands on the closest free face', (stack, family) => {
    const doc = docOf(pageOf([text('Stack', { style: { fontFamily: stack, fontSize: 16, fontWeight: 400 } })]));

    expect(clipsOf(doc).find((c) => c.props.text === 'Stack')?.props.font).toBe(family);
  });

  it('a page font that Google also has comes from the page, so it keeps the page metrics', () => {
    const inter = { family: 'inter', weight: '100 900', style: 'normal', url: 'https://example.com/inter.woff2' };
    const tree = { ...pageOf([text('Same face', { style: { fontFamily: 'inter', fontSize: 16, fontWeight: 400 } })]), fonts: [inter] };
    let n = 0;
    const doc = urlPlan(tree, () => `c${++n}`, undefined, { [inter.url]: 'font-1' })!.plan.items[0].doc;

    expect(fontsWanted(tree)).toEqual([inter]);
    expect(doc.fonts.find((f) => f.family === 'inter')?.variants).toEqual([{ assetId: 'font-1', weight: 400, italic: false }]);
  });

  it('only the faces the text uses are asked for', () => {
    const tree = withFont({ fontFamily: 'Acme Sans', fontSize: 16, fontWeight: 400 });

    expect(fontsWanted(tree)).toEqual([FACE]);
    expect(fontsWanted(pageOf([text('Plain')]))).toEqual([]);
  });

  it('a run in another case of a Google family keeps the text size', () => {
    const tree = pageOf([text('Bold here', { characterStyleOverrides: [0, 0, 0, 0, 0, 1, 1, 1, 1], styleOverrideTable: { '1': { fontFamily: 'inter', fontWeight: 700, fontSize: 16 } } })]);
    let n = 0;
    const made = urlPlan(tree, () => `c${++n}`)!;
    const doc = made.plan.items[0].doc;
    const clip = clipsOf(doc).find((c) => c.props.text === 'Bold here')!;

    expect(made.plan.skipped.filter((s) => s.includes('not in this video'))).toEqual([]);
    expect(clip.props.size).toBeCloseTo((16 * doc.width) / 1280 / Math.min(doc.width, doc.height), 3);
  });
});
