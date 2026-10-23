import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePath } from './geometry';
import { svgShapes } from './svg-import';

const box = (d: string) => {
  const outline = parsePath(d);
  if (typeof outline === 'string') {
    throw new Error(outline);
  }
  const xs = outline.flatMap((c) => c.vertices.map((v) => v.p[0]));
  const ys = outline.flatMap((c) => c.vertices.map((v) => v.p[1]));
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
};

describe('svgShapes', () => {
  it('turns rect, circle, polygon and path into fillable paths in svg units', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">
      <rect x="10" y="5" width="20" height="10" fill="#ff0000"/>
      <circle cx="50" cy="25" r="10" style="fill: #00ff00"/>
      <polygon points="0,0 10,0 5,8" fill="blue"/>
      <path d="m 60 10 h 10 v 10 z" fill="#123"/>
    </svg>`;
    const read = svgShapes(svg);
    expect(read.size).toEqual({ width: 100, height: 50 });
    expect(read.shapes.map((s) => s.fill)).toEqual(['#ff0000', '#00ff00', '#0000ff', '#112233']);
    expect(box(read.shapes[0].path)).toEqual({ left: 10, top: 5, right: 30, bottom: 15 });
    expect(box(read.shapes[1].path)).toEqual({ left: 40, top: 15, right: 60, bottom: 35 });
    expect(box(read.shapes[3].path)).toEqual({ left: 60, top: 10, right: 70, bottom: 20 });
  });

  it('scales the viewBox to the width and height and applies transforms', () => {
    const svg = `<svg width="48" height="48" viewBox="0 0 24 24"><g transform="translate(2 2)"><rect width="10" height="10"/></g></svg>`;
    const read = svgShapes(svg);
    expect(read.size).toEqual({ width: 48, height: 48 });
    expect(box(read.shapes[0].path)).toEqual({ left: 4, top: 4, right: 24, bottom: 24 });
  });

  it('converts arcs to curves the path parser accepts', () => {
    const read = svgShapes(`<svg viewBox="0 0 20 20"><path d="M0 10 A10 10 0 0 1 20 10 Z"/></svg>`);
    const b = box(read.shapes[0].path);
    expect(b.left).toBeCloseTo(0);
    expect(b.right).toBeCloseTo(20);
  });

  it('skips shapes filled with none and keeps a stroke-only line as stroked', () => {
    const read = svgShapes(`<svg viewBox="0 0 10 10"><rect width="5" height="5" fill="none"/><line x1="0" y1="0" x2="10" y2="10" stroke="#000"/></svg>`);
    expect(read.shapes).toHaveLength(1);
    expect(read.shapes[0]).toMatchObject({ fill: null, stroke: '#000000' });
  });

  it('refuses text that is not svg', () => {
    expect(svgShapes('hello').shapes).toEqual([]);
  });

  it('reads a linear gradient fill as a gradient layer with its stops and angle', () => {
    const svg = `<svg viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>`;
    const [shape] = svgShapes(svg).shapes;
    expect(shape.fill).toBe('#ff0000');
    expect(shape.gradient).toEqual({
      type: 'linear-gradient',
      stops: [
        { color: '#ff0000', pos: 0 },
        { color: '#0000ff', pos: 1 }
      ],
      angle: 90
    });
  });

  it('reads a radial gradient with its centre and radius in box units', () => {
    const svg = `<svg viewBox="0 0 100 100"><defs><radialGradient id="r" cx="0.25" cy="0.75" r="0.5"><stop offset="0" style="stop-color:#ffffff"/><stop offset="100%" stop-color="#000000"/></radialGradient></defs><circle cx="50" cy="50" r="40" fill="url(#r)"/></svg>`;
    const [shape] = svgShapes(svg).shapes;
    expect(shape.gradient).toMatchObject({ type: 'radial-gradient', center: { x: 0.25, y: 0.75 }, radius: 1 });
  });

  it('measures a user-space gradient against the shape it paints', () => {
    const svg = `<svg viewBox="0 0 100 100"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect x="50" width="50" height="100" fill="url(#g)"/></svg>`;
    const [shape] = svgShapes(svg).shapes;
    expect(shape.gradient).toMatchObject({ type: 'linear-gradient', angle: 0 });
  });

  it('falls back to the first stop when a gradient is missing', () => {
    const [shape] = svgShapes(`<svg viewBox="0 0 10 10"><rect width="5" height="5" fill="url(#nope)"/></svg>`).shapes;
    expect(shape.gradient).toBeUndefined();
    expect(shape.fill).toBe('#000000');
  });

  it('rounds the corners of a rect with rx and ry', () => {
    const [shape] = svgShapes(`<svg viewBox="0 0 100 50"><rect width="100" height="50" rx="10" fill="#000"/></svg>`).shapes;
    expect(shape.path).toContain('C');
    expect(box(shape.path)).toEqual({ left: 0, top: 0, right: 100, bottom: 50 });
  });

  it('caps a corner radius at half the short side', () => {
    const [shape] = svgShapes(`<svg viewBox="0 0 100 50"><rect width="100" height="50" rx="90" fill="#000"/></svg>`).shapes;
    expect(box(shape.path)).toEqual({ left: 0, top: 0, right: 100, bottom: 50 });
  });

  it('clamps a rect to its clip path and drops shapes outside it', () => {
    const svg = `<svg viewBox="0 0 100 100"><defs><clipPath id="c"><rect x="0" y="0" width="50" height="100"/></clipPath></defs><g clip-path="url(#c)"><rect x="25" width="50" height="100" fill="#f00"/><rect x="60" width="30" height="100" fill="#0f0"/></g></svg>`;
    const read = svgShapes(svg);
    expect(read.shapes).toHaveLength(1);
    expect(box(read.shapes[0].path)).toEqual({ left: 25, top: 0, right: 50, bottom: 100 });
  });

  it('reads text as positioned text with size, colour and weight', () => {
    const svg = `<svg viewBox="0 0 200 100"><text x="20" y="50" font-size="24" font-weight="700" fill="#336699" font-family="Inter, sans-serif">Hello &amp; bye</text></svg>`;
    const read = svgShapes(svg);
    expect(read.shapes).toEqual([]);
    expect(read.texts).toEqual([{ text: 'Hello & bye', x: 20, y: 50, size: 24, fill: '#336699', weight: 700, anchor: 'start' }]);
  });

  it('scales and offsets text with the transforms above it and splits tspans into lines', () => {
    const svg = `<svg viewBox="0 0 100 100"><g transform="translate(10 10) scale(2)"><text x="5" y="10" font-size="10" text-anchor="middle"><tspan x="5" dy="0">one</tspan><tspan x="5" dy="12">two</tspan></text></g></svg>`;
    const [text] = svgShapes(svg).texts;
    expect(text).toMatchObject({ text: 'one\ntwo', x: 20, y: 30, size: 20, anchor: 'middle' });
  });
});

const fixture = (name: string) => readFileSync(`tests/fixtures/svg/${name}.svg`, 'utf8');
const outlineOf = (d: string) => {
  const outline = parsePath(d);
  if (typeof outline === 'string') {
    throw new Error(outline);
  }
  return outline;
};

describe('svgShapes fill rule and real-world paths', () => {
  it('keeps the two subpaths and the evenodd rule of the Designflow logo', () => {
    const [shape] = svgShapes(fixture('designflow-logo')).shapes;
    const outline = outlineOf(shape.path);
    expect(shape.fillRule).toBe('evenodd');
    expect(outline).toHaveLength(2);
    expect(outline.every((c) => c.closed)).toBe(true);
    expect(box(shape.path)).toEqual({ left: 0, top: 0, right: 40.134, bottom: 40.134 });
  });

  it('defaults to nonzero and inherits evenodd from a group', () => {
    expect(svgShapes(fixture('nested-nonzero')).shapes[0].fillRule).toBe('nonzero');
    expect(svgShapes(fixture('nested-evenodd')).shapes[0].fillRule).toBe('evenodd');
  });

  it('ignores clip-rule when reading the fill rule', () => {
    const read = svgShapes(`<svg viewBox="0 0 10 10"><path d="M0 0H10V10Z" clip-rule="evenodd"/></svg>`);
    expect(read.shapes[0].fillRule).toBe('nonzero');
  });

  it('reads relative commands, with a subpath that starts from the previous start point', () => {
    const [shape] = svgShapes(fixture('relative-nonzero-hole')).shapes;
    const outline = outlineOf(shape.path);
    expect(outline.map((c) => c.vertices.map((v) => v.p))).toEqual([
      [[5, 5], [35, 5], [35, 35], [5, 35]],
      [[10, 10], [10, 30], [30, 30], [30, 10]]
    ]);
  });

  it('turns arcs into curves that stay on the circle', () => {
    const [shape] = svgShapes(fixture('arcs-evenodd-ring')).shapes;
    expect(outlineOf(shape.path)).toHaveLength(2);
    const b = box(shape.path);
    expect(b.left).toBeCloseTo(5, 1);
    expect(b.right).toBeCloseTo(35, 1);
  });

  it('expands S and T like the explicit C and Q they stand for', () => {
    const [shorthand] = svgShapes(fixture('smooth-shorthands')).shapes;
    const explicit = svgShapes(`<svg viewBox="0 0 40 40"><path d="M5 30C5 10 20 10 20 30C20 50 35 50 35 30ZM5 36Q12 30 20 36Q28 42 35 36Z"/></svg>`).shapes[0];
    expect(shorthand.path).toBe(explicit.path);
  });
});
