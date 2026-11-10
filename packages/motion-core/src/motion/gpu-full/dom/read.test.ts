import { describe, expect, it } from 'vitest';
import { readTree, DrawnKind, type Drawn } from './read';
import { Op, type Face } from '../text/face';
import { Smoothing } from '../text/painter';
import type { RawNode } from './tree';

const SQUARE: Face = {
  unitsPerEm: 1000,
  ascent: 800,
  descent: 200,
  shape: () => [{ glyph: 1, advance: 600, dx: 0, dy: 0, chars: 1 }],
  outline: () => [
    { op: Op.Move, at: [0, 0] },
    { op: Op.Line, at: [500, 0] },
    { op: Op.Line, at: [500, 700] },
    { op: Op.Close, at: [] }
  ]
};

const node = (over: Partial<RawNode>): RawNode => ({ tag: 'div', svg: false, parent: -1, at: [0, 0], size: [100, 20], style: {}, attrs: {}, text: '', lines: [], raster: null, layer: -1, ...over });

const pathsOf = (drawn: Drawn[]): number[][] => drawn.flatMap((d) => (d.kind === DrawnKind.Path ? d.contours : d.kind === DrawnKind.Group ? pathsOf(d.items) : []));

describe('readTree', () => {
  it('text inside an element scaled to zero width draws finite glyphs, so the gpu core does not trap on null', () => {
    const tree = {
      width: 100,
      height: 20,
      defs: {},
      nodes: [
        node({ style: { transform: 'matrix(0, 0, 0, 1, 0, 0)' } }),
        node({ parent: 0, tag: '#text', text: 'L', style: { color: 'rgb(90, 58, 22)', 'font-size': '10px', 'font-family': 'Mono' }, lines: [{ chars: ['L'], xs: [3], top: 0, height: 12 }] })
      ]
    };

    const contours = pathsOf(readTree(tree, { fonts: () => ({ face: SQUARE, skew: 0 }), smoothing: Smoothing.Plain }).drawn);

    expect(contours.length).toBeGreaterThan(0);
    expect(contours.flat().every(Number.isFinite)).toBe(true);
  });

  it('a video a component draws itself paints its current frame, like a picture', () => {
    const tree = { width: 100, height: 60, defs: {}, nodes: [node({ size: [100, 60] }), node({ parent: 0, tag: 'video', size: [100, 60], layer: 0 })] };

    const drawn = JSON.stringify(readTree(tree, { fonts: () => ({ face: SQUARE, skew: 0 }), smoothing: Smoothing.Plain }).drawn);

    expect(drawn).toContain(`"kind":"${DrawnKind.Layer}"`);
  });
});
