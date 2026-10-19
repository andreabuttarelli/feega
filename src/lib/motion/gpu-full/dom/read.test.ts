import { describe, expect, it } from 'vitest';
import { apply2d } from '../../affine';
import { FillRule, PaintKind } from '../paint';
import { DomGap, DrawnKind, readTree, type DrawnPath } from './read';
import { NO_INDEX, TEXT_PAD, type RawNode, type RawTree } from './tree';
import { boxBook } from '../text/test-face';
import { Smoothing } from '../text/painter';
import { BlendMode } from '../../blend';
import { MaskMode } from '../../mask';
import { CoverKind } from '../mask-layers';
import { FilterKind } from '../filters';
import type { SvgNode } from '../../effects/registry';

const FRAME = { width: 400, height: 300 };

function el(part: Partial<RawNode> & { parent: number }): RawNode {
  return { tag: 'div', svg: false, at: [0, 0], size: [0, 0], style: {}, attrs: {}, text: '', lines: [], raster: null, layer: NO_INDEX, ...part };
}

const root = (style: RawNode['style'] = {}) => el({ parent: NO_INDEX, size: [FRAME.width, FRAME.height], style });
const tree = (...nodes: RawNode[]): RawTree => ({ ...FRAME, nodes, defs: {} });
const paths = (t: RawTree) => readTree(t).drawn.filter((d): d is DrawnPath => d.kind === DrawnKind.Path);

function bounds(item: DrawnPath) {
  const pts = item.contours.flatMap((c) => Array.from({ length: c.length / 2 }, (_, i) => apply2d(item.matrix, [c[2 * i], c[2 * i + 1]])));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

const near = (b: ReturnType<typeof bounds>) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 100) / 100]));

describe('readTree', () => {
  it('leaves the root z-index to the order of clips, and still refuses it inside', () => {
    const box = el({ parent: 0, size: [10, 10], style: { 'background-color': 'rgb(0, 0, 0)' } });

    expect(readTree(tree(root({ 'z-index': '3' }), box))).toMatchObject({ gaps: [], drawn: [{ kind: DrawnKind.Path }] });
    expect(readTree(tree(root(), { ...box, style: { ...box.style, 'z-index': '3' } })).gaps).toMatchObject([{ reason: DomGap.Order }]);
  });

  it('fills a box background at its position inside its parents', () => {
    const t = tree(root(), el({ parent: 0, at: [10, 20], size: [100, 100] }), el({ parent: 1, at: [5, 5], size: [30, 40], style: { 'background-color': 'rgb(255, 0, 0)' } }));

    const [box] = paths(t);

    expect(near(bounds(box))).toEqual({ left: 15, top: 25, right: 45, bottom: 65 });
    expect(box.paint).toEqual({ kind: PaintKind.Solid, color: [1, 0, 0, 1] });
  });

  it('paints a transformed box from a whole-pixel offset, as the browser does', () => {
    const turned = el({ parent: 0, at: [100.4, 99.6], size: [40, 20], style: { 'background-color': 'rgb(0, 0, 0)', transform: 'matrix(1, 0, 0, 1, 0, 0)' } });

    expect(near(bounds(paths(tree(root(), turned))[0]))).toEqual({ left: 100, top: 100, right: 140, bottom: 120 });
  });

  it('turns a box about its transform origin', () => {
    const turned = el({ parent: 0, at: [100, 100], size: [40, 20], style: { 'background-color': 'rgb(0, 0, 0)', transform: 'matrix(0, 1, -1, 0, 0, 0)', 'transform-origin': '20px 10px' } });

    expect(near(bounds(paths(tree(root(), turned))[0]))).toEqual({ left: 110, top: 90, right: 130, bottom: 130 });
  });

  it('fills an svg polygon in the svg viewport, offset by where the svg sits', () => {
    const svg = el({ parent: 0, tag: 'svg', svg: true, at: [50, 0], size: [200, 200], attrs: { width: '200', height: '200' } });
    const polygon = el({ parent: 1, tag: 'polygon', svg: true, at: null, attrs: { points: '0,0 10,0 10,10' }, style: { fill: 'rgb(0, 0, 255)', 'fill-rule': 'evenodd', 'fill-opacity': '0.5' } });

    const [shape] = paths(tree(root(), svg, polygon));

    expect(near(bounds(shape))).toEqual({ left: 50, top: 0, right: 60, bottom: 10 });
    expect(shape.rule).toBe(FillRule.EvenOdd);
    expect(shape.opacity).toBeCloseTo(0.5);
  });

  it('names text as not drawn and still paints the box behind it', () => {
    const label = el({ parent: 0, size: [100, 40], text: 'hello', attrs: { class: 'title' }, style: { 'background-color': 'rgb(0, 0, 0)' } });

    const read = readTree(tree(root(), label));

    expect(read.drawn).toHaveLength(1);
    expect(read.gaps).toEqual([{ element: 'div.title', reason: DomGap.Text, count: 1 }]);
  });

  it('rounds a square with a 50% radius into a circle', () => {
    const dot = el({ parent: 0, at: [0, 0], size: [100, 100], style: { 'background-color': 'rgb(0, 0, 0)', 'border-top-left-radius': '50%', 'border-top-right-radius': '50%', 'border-bottom-right-radius': '50%', 'border-bottom-left-radius': '50%' } });

    const [circle] = paths(tree(root(), dot));
    const [x, y] = apply2d(circle.matrix, [circle.contours[0][0], circle.contours[0][1]]);

    expect(circle.contours[0].length).toBeGreaterThan(16);
    expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(50, 1);
  });

  it('draws a solid border as a ring around the padding box', () => {
    const solid = { 'border-top-width': '2px', 'border-top-style': 'solid', 'border-top-color': 'rgb(0, 0, 0)' };
    const ruled = el({ parent: 0, at: [10, 10], size: [100, 30], style: solid });

    const [ring] = paths(tree(root(), ruled));

    expect(ring.rule).toBe(FillRule.EvenOdd);
    expect(ring.contours).toHaveLength(2);
    expect(near(bounds(ring))).toEqual({ left: 10, top: 10, right: 110, bottom: 40 });
  });

  it('tiles a sized linear gradient across the box', () => {
    const grid = el({ parent: 0, size: [100, 50], style: { 'background-image': 'linear-gradient(90deg, rgb(0, 0, 0) 1px, rgba(0, 0, 0, 0) 1px)', 'background-size': '25px 25px' } });

    const tiles = paths(tree(root(), grid));

    expect(tiles).toHaveLength(8);
    expect(tiles[1].paint).toMatchObject({ kind: PaintKind.Linear, from: [25, 12.5], to: [50, 12.5], stops: [{ at: 0.04 }, { at: 0.04 }] });
  });

  it('spans an unsized gradient over the whole box along its angle', () => {
    const wash = el({ parent: 0, size: [100, 50], style: { 'background-image': 'linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255))' } });

    expect(paths(tree(root(), wash))[0].paint).toMatchObject({ kind: PaintKind.Linear, from: [50, expect.closeTo(0)], to: [50, expect.closeTo(50)], stops: [{ at: 0 }, { at: 1 }] });
  });

  it('leaves out a subtree whose filter mixes its items together and names it', () => {
    const blurred = el({ parent: 0, size: [50, 50], attrs: { class: 'soft' }, style: { filter: 'drop-shadow(rgb(0, 0, 0) 2px 2px 4px)', 'background-color': 'rgb(0, 0, 0)' } });
    const child = el({ parent: 1, size: [10, 10], style: { 'background-color': 'rgb(0, 0, 0)' } });

    const read = readTree(tree(root(), blurred, child));

    expect(read.drawn).toEqual([]);
    expect(read.gaps).toEqual([{ element: 'div.soft', reason: DomGap.Filter, count: 1 }]);
  });

  it('composites a canvas as a layer over its css box', () => {
    const canvas = el({ parent: 0, tag: 'canvas', at: [10, 0], size: [320, 180], layer: 0, style: { opacity: '0.5' } });

    expect(readTree(tree(root(), canvas)).drawn).toEqual([{ kind: DrawnKind.Layer, layer: 0, width: 320, height: 180, opacity: 0.5, matrix: [1, 0, 0, 1, 10, 0] }]);
  });

  it('refuses a rounded clipping box whose content spills out of it', () => {
    const clip = el({ parent: 0, size: [50, 50], style: { overflow: 'hidden', 'border-top-left-radius': '8px' } });
    const inside = el({ parent: 1, size: [10, 10], style: { 'background-color': 'rgb(0, 0, 0)' } });
    const outside = el({ parent: 1, at: [45, 0], size: [10, 10], style: { 'background-color': 'rgb(0, 0, 0)' } });

    expect(readTree(tree(root(), clip, inside)).drawn).toHaveLength(1);
    expect(readTree(tree(root(), clip, inside, outside)).gaps.map((g) => g.reason)).toEqual([DomGap.Clip]);
  });

  it('multiplies opacity into a single painted leaf but refuses it over a group', () => {
    const faded = (n: number) => [el({ parent: 0, size: [50, 50], style: { opacity: '0.5' } }), ...Array.from({ length: n }, () => el({ parent: 1, size: [10, 10], style: { 'background-color': 'rgb(0, 0, 0)' } }))];

    expect(paths(tree(root(), ...faded(1)))[0].opacity).toBeCloseTo(0.5);
    expect(readTree(tree(root(), ...faded(2))).gaps.map((g) => g.reason)).toEqual([DomGap.Opacity]);
  });

  it('draws an svg fill without a stroke it cannot dash and names the stroke', () => {
    const svg = el({ parent: 0, tag: 'svg', svg: true, size: [100, 100] });
    const rect = el({ parent: 1, tag: 'rect', svg: true, at: null, attrs: { x: '10', y: '10', width: '20', height: '20' }, style: { fill: 'rgb(0, 0, 0)', stroke: 'rgb(255, 255, 255)', 'stroke-width': '2px', 'stroke-dasharray': '1 2 3' } });

    const read = readTree(tree(root(), svg, rect));

    expect(read.drawn).toHaveLength(1);
    expect(read.gaps.map((g) => g.reason)).toEqual([DomGap.Stroke]);
  });

  it('skips a transparent svg fill, the hit area of an editable part', () => {
    const svg = el({ parent: 0, tag: 'svg', svg: true, size: [100, 100] });
    const hit = el({ parent: 1, tag: 'rect', svg: true, at: null, attrs: { width: '20', height: '20' }, style: { fill: 'rgba(0, 0, 0, 0)' } });

    expect(readTree(tree(root(), svg, hit))).toEqual({ drawn: [], gaps: [] });
  });

  it('names a fill that points at an svg paint server', () => {
    const svg = el({ parent: 0, tag: 'svg', svg: true, size: [100, 100] });
    const rects = [1, 2].map(() => el({ parent: 1, tag: 'rect', svg: true, at: null, attrs: { width: '20', height: '20' }, style: { fill: 'url("#sky")' } }));

    expect(readTree(tree(root(), svg, ...rects)).gaps).toEqual([{ element: 'rect', reason: DomGap.Paint, count: 2 }]);
  });

  it('paints in-flow boxes before positioned siblings, as css stacks them', () => {
    const lifted = el({ parent: 0, size: [10, 10], style: { position: 'absolute', 'background-color': 'rgb(255, 0, 0)' } });
    const flow = el({ parent: 0, size: [10, 10], style: { position: 'static', 'background-color': 'rgb(0, 0, 255)' } });

    expect(paths(tree(root(), lifted, flow)).map((p) => p.paint)).toEqual([
      { kind: PaintKind.Solid, color: [0, 0, 1, 1] },
      { kind: PaintKind.Solid, color: [1, 0, 0, 1] }
    ]);
  });

  it('names media it cannot draw', () => {
    expect(readTree(tree(root(), el({ parent: 0, tag: 'img', size: [10, 10] }))).gaps.map((g) => g.reason)).toEqual([DomGap.Media]);
  });
  describe('text', () => {
    const typeset = (missing: string[] = []) => ({ fonts: boxBook(new Set(missing)), smoothing: Smoothing.Plain });
    const line = (chars: string[], xs: number[], top = 30) => ({ chars, xs, top, height: 10 });
    const label = (part: Partial<RawNode> = {}) => el({ parent: 0, at: [10, 10], size: [100, 40], text: 'ab', lines: [line(['a', 'b'], [20, 26])], style: { color: 'rgb(255, 0, 0)', 'font-family': '"Inter Tight", system-ui', 'font-size': '10px', 'font-weight': '600' }, ...part });

    it('draws every glyph where the browser placed it, on the line baseline', () => {
      const read = readTree(tree(root(), label()), typeset());
      const glyphs = read.drawn as DrawnPath[];

      expect(read.gaps).toEqual([]);
      expect(glyphs.map((g) => near(bounds(g)))).toEqual([
        { left: 30, top: 41, right: 35, bottom: 48 },
        { left: 36, top: 41, right: 41, bottom: 48 }
      ]);
      expect(glyphs[0].paint).toEqual({ kind: PaintKind.Solid, color: [1, 0, 0, 1] });
    });

    it('does not darken stems the page asked to render without', () => {
      const dilated = { fonts: boxBook(), smoothing: Smoothing.Dilated };
      const plain = readTree(tree(root(), label({ style: { ...label().style, '-webkit-font-smoothing': 'antialiased' } })), dilated);

      expect(near(bounds(plain.drawn[0] as DrawnPath))).toEqual({ left: 30, top: 41, right: 35, bottom: 48 });
    });

    it('sits upright text on a whole device pixel, as the browser does', () => {
      const read = readTree(tree(root(), label({ lines: [{ chars: ['a'], xs: [20.4], top: 30.3, height: 10 }] })), typeset());

      expect(near(bounds(read.drawn[0] as DrawnPath))).toEqual({ left: 30.4, top: 41, right: 35.4, bottom: 48 });
    });

    it('draws the case the browser shows, not the case typed', () => {
      const read = readTree(tree(root(), label({ style: { ...label().style, 'text-transform': 'uppercase' } })), typeset(['a', 'b']));

      expect(read.drawn).toHaveLength(2);
      expect(read.gaps).toEqual([]);
    });

    it('names a glyph no loaded font covers', () => {
      const read = readTree(tree(root(), label()), typeset(['b']));

      expect(read.drawn).toHaveLength(1);
      expect(read.gaps.map((g) => g.reason)).toEqual([DomGap.Font]);
    });

    it('draws text set in a font the page never loaded from the raster the browser made of it', () => {
      const read = readTree(tree(root(), label({ raster: { layer: 3, width: 120, height: 60 } })), typeset(['a', 'b']));

      expect(read.gaps).toEqual([]);
      expect(read.drawn).toEqual([{ kind: DrawnKind.Layer, layer: 3, width: 120, height: 60, opacity: 1, matrix: [1, 0, 0, 1, 10 - TEXT_PAD, 10 - TEXT_PAD] }]);
    });
  });
  describe('svg groups', () => {
    const svg = () => el({ parent: 0, tag: 'svg', svg: true, at: [0, 0], size: [400, 300] });
    const g = (style: RawNode['style'] = {}) => el({ parent: 1, tag: 'g', svg: true, at: null, style });
    const rect = (parent: number, style: RawNode['style'] = {}) => el({ parent, tag: 'rect', svg: true, at: null, attrs: { width: '400', height: '300' }, style: { fill: 'rgb(0, 0, 0)', ...style } });
    const blur = { tag: 'filter', attrs: { id: 'soft' }, children: [{ tag: 'feGaussianBlur', attrs: { stdDeviation: '1.2' } }] };
    const noise = { tag: 'filter', attrs: { id: 'noise' }, children: [{ tag: 'feTurbulence', attrs: { baseFrequency: '0.9' } }] };
    const clip = { tag: 'clipPath', attrs: { id: 'tiles' }, children: [{ tag: 'rect', attrs: { x: '10', y: '20', width: '30', height: '40' } }] };
    const withDefs = (t: RawTree): RawTree => ({ ...t, defs: { soft: blur, noise, tiles: clip } });

    it('clips every item of a group to its clip path', () => {
      const read = readTree(withDefs(tree(root(), svg(), g({ 'clip-path': 'url("#tiles")' }), rect(2), rect(2))));

      expect(read.gaps).toEqual([]);
      expect(read.drawn).toHaveLength(2);
      for (const item of read.drawn) {
        expect(item.masks).toEqual([{ mode: MaskMode.Intersect, invert: false, level: 1, feather: 0, cover: { kind: CoverKind.Path, contours: [[10, 20, 40, 20, 40, 60, 10, 60]], matrix: [1, 0, 0, 1, 0, 0] } }]);
      }
    });

    it('filters and blends a single shape with the filter its attribute names', () => {
      const [item] = readTree(withDefs(tree(root(), svg(), rect(1, { filter: 'url("#noise")', 'mix-blend-mode': 'multiply', opacity: '0.35' })))).drawn;

      expect(item.filters?.map((f) => f.kind)).toEqual([FilterKind.Svg]);
      expect(item.blend).toBe(BlendMode.Multiply);
      expect(item.opacity).toBeCloseTo(0.35);
    });

    it('lays noise over the filter region, a tenth of the shape beyond each side', () => {
      const [item] = readTree(withDefs(tree(root(), svg(), rect(1, { filter: 'url("#noise")' })))).drawn;
      const filter = item.filters?.[0];
      const turbulence = filter?.kind === FilterKind.Svg ? filter.nodes[0].children?.[0] : null;

      expect(turbulence?.attrs).toMatchObject({ x: -40, y: -30, width: 480, height: 360 });
    });

    it('blurs each shape of a blurred group', () => {
      const read = readTree(withDefs(tree(root(), svg(), g({ filter: 'url("#soft")' }), rect(2), rect(2))));

      expect(read.gaps).toEqual([]);
      expect(read.drawn.map((d) => d.filters)).toEqual([[{ kind: FilterKind.Svg, nodes: [blur] }], [{ kind: FilterKind.Svg, nodes: [blur] }]]);
    });

    it('refuses a group whose filter mixes its shapes together', () => {
      const read = readTree(withDefs(tree(root(), svg(), g({ filter: 'url("#noise")' }), rect(2), rect(2))));

      expect(read.drawn).toEqual([]);
      expect(read.gaps.map((g) => g.reason)).toEqual([DomGap.Filter]);
    });

    it('refuses a group that blends as one', () => {
      const read = readTree(withDefs(tree(root(), svg(), g({ 'mix-blend-mode': 'multiply' }), rect(2), rect(2))));

      expect(read.gaps.map((g) => g.reason)).toEqual([DomGap.Blend]);
    });
  });
  describe('svg paint', () => {
    const svg = (style: RawNode['style'] = {}) => el({ parent: 0, tag: 'svg', svg: true, at: [0, 0], size: [400, 300], style });
    const shape = (tag: string, attrs: RawNode['attrs'], style: RawNode['style']) => el({ parent: 1, tag, svg: true, at: null, attrs, style });
    const sky: SvgNode = { tag: 'linearGradient', attrs: { id: 'sky', x1: '0', y1: '0', x2: '0.3', y2: '1' }, children: [{ tag: 'stop', attrs: { offset: '0', 'stop-color': '#ffffff' } }, { tag: 'stop', attrs: { offset: '1', 'stop-color': '#000000', 'stop-opacity': '0.5' } }] };
    const mesh: SvgNode = { tag: 'pattern', attrs: { id: 'mesh', width: '5', height: '5', patternUnits: 'userSpaceOnUse' }, children: [{ tag: 'rect', attrs: { width: '5', height: '1', fill: '#000', opacity: '0.12' } }] };
    const read = (...nodes: RawNode[]) => readTree({ ...tree(root(), ...nodes), defs: { sky, mesh } });

    it('fills with a linear gradient laid over the shape bounding box', () => {
      const { drawn, gaps } = read(svg(), shape('rect', { x: '10', y: '20', width: '100', height: '50' }, { fill: 'url("#sky")' }));
      const [item] = drawn as DrawnPath[];

      expect(gaps).toEqual([]);
      expect(item.paint).toEqual({ kind: PaintKind.Linear, from: [0, 0], to: [0.3, 1], stops: [{ at: 0, color: [1, 1, 1, 1] }, { at: 1, color: [0, 0, 0, 0.5] }] });
      expect(near(bounds(item))).toEqual({ left: 10, top: 20, right: 110, bottom: 70 });
    });

    it('fills with a user-space pattern of rects, one run per row', () => {
      const { drawn, gaps } = read(svg(), shape('rect', { width: '20', height: '10' }, { fill: 'url("#mesh")' }));
      const [item] = drawn as DrawnPath[];

      expect(gaps).toEqual([]);
      expect(item.contours).toEqual([
        [0, 0, 20, 0, 20, 1, 0, 1],
        [0, 5, 20, 5, 20, 6, 0, 6]
      ]);
      expect(item.paint).toEqual({ kind: PaintKind.Solid, color: [0, 0, 0, 1] });
      expect(item.opacity).toBeCloseTo(0.12);
    });

    it('strokes a shape over its fill', () => {
      const { drawn, gaps } = read(svg(), shape('circle', { cx: '50', cy: '50', r: '10' }, { fill: 'rgb(0, 0, 0)', stroke: 'rgb(255, 255, 255)', 'stroke-width': '4' }));
      const [, ring] = drawn as DrawnPath[];

      expect(gaps).toEqual([]);
      expect(ring.rule).toBe(FillRule.Union);
      expect(ring.paint).toEqual({ kind: PaintKind.Solid, color: [1, 1, 1, 1] });
      expect(near(bounds(ring))).toEqual({ left: 38, top: 38, right: 62, bottom: 62 });
    });

    it('clips what spills out of a box that hides its overflow', () => {
      const { drawn, gaps } = read(svg({ overflow: 'hidden' }), shape('rect', { x: '-10', width: '50', height: '50' }, { fill: 'rgb(0, 0, 0)' }));

      expect(gaps).toEqual([]);
      expect(drawn[0].masks?.[0].cover).toEqual({ kind: CoverKind.Path, contours: [[0, 0, 400, 0, 400, 300, 0, 300]], matrix: [1, 0, 0, 1, 0, 0] });
    });
  });
});
