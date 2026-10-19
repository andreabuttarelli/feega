import { describe, expect, it } from 'vitest';
import { apply2d } from '../../affine';
import { FillRule, PaintKind } from '../paint';
import { DomGap, DrawnKind, readTree, type DrawnPath } from './read';
import { NO_INDEX, TEXT_PAD, type RawNode, type RawTree } from './tree';
import { boxBook } from '../text/test-face';
import { Smoothing } from '../text/painter';

const FRAME = { width: 400, height: 300 };

function el(part: Partial<RawNode> & { parent: number }): RawNode {
  return { tag: 'div', svg: false, at: [0, 0], size: [0, 0], style: {}, attrs: {}, text: '', lines: [], raster: null, layer: NO_INDEX, ...part };
}

const root = (style: RawNode['style'] = {}) => el({ parent: NO_INDEX, size: [FRAME.width, FRAME.height], style });
const tree = (...nodes: RawNode[]): RawTree => ({ ...FRAME, nodes });
const paths = (t: RawTree) => readTree(t).drawn.filter((d): d is DrawnPath => d.kind === DrawnKind.Path);

function bounds(item: DrawnPath) {
  const pts = item.contours.flatMap((c) => Array.from({ length: c.length / 2 }, (_, i) => apply2d(item.matrix, [c[2 * i], c[2 * i + 1]])));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

const near = (b: ReturnType<typeof bounds>) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 100) / 100]));

describe('readTree', () => {
  it('fills a box background at its position inside its parents', () => {
    const t = tree(root(), el({ parent: 0, at: [10, 20], size: [100, 100] }), el({ parent: 1, at: [5, 5], size: [30, 40], style: { 'background-color': 'rgb(255, 0, 0)' } }));

    const [box] = paths(t);

    expect(near(bounds(box))).toEqual({ left: 15, top: 25, right: 45, bottom: 65 });
    expect(box.paint).toEqual({ kind: PaintKind.Solid, color: [1, 0, 0, 1] });
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

  it('leaves out a filtered subtree and names it', () => {
    const blurred = el({ parent: 0, size: [50, 50], attrs: { class: 'soft' }, style: { filter: 'blur(4px)', 'background-color': 'rgb(0, 0, 0)' } });
    const child = el({ parent: 1, size: [10, 10], style: { 'background-color': 'rgb(0, 0, 0)' } });

    const read = readTree(tree(root(), blurred, child));

    expect(read.drawn).toEqual([]);
    expect(read.gaps).toEqual([{ element: 'div.soft', reason: DomGap.Filter, count: 1 }]);
  });

  it('composites a canvas as a layer over its css box', () => {
    const canvas = el({ parent: 0, tag: 'canvas', at: [10, 0], size: [320, 180], layer: 0, style: { opacity: '0.5' } });

    expect(readTree(tree(root(), canvas)).drawn).toEqual([{ kind: DrawnKind.Layer, layer: 0, width: 320, height: 180, opacity: 0.5, matrix: [1, 0, 0, 1, 10, 0] }]);
  });

  it('refuses a clipping box whose content spills out of it', () => {
    const clip = el({ parent: 0, size: [50, 50], style: { overflow: 'hidden' } });
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

  it('draws an svg fill without its stroke and names the stroke', () => {
    const svg = el({ parent: 0, tag: 'svg', svg: true, size: [100, 100] });
    const rect = el({ parent: 1, tag: 'rect', svg: true, at: null, attrs: { x: '10', y: '10', width: '20', height: '20' }, style: { fill: 'rgb(0, 0, 0)', stroke: 'rgb(255, 255, 255)', 'stroke-width': '2px' } });

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
});
