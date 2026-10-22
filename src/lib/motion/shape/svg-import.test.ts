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
});
