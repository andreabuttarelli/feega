import { describe, expect, it } from 'vitest';
import { pageKit } from './page-kit';

const kit = pageKit();

const shipped = new Function(`return (${pageKit.toString()})()`)() as ReturnType<typeof pageKit>;

const colour = (raw: string) => {
  const named: Record<string, [number, number, number, number]> = { red: [1, 0, 0, 1], blue: [0, 0, 1, 1], white: [1, 1, 1, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
  const hit = named[raw.trim()];
  if (hit) {
    return { r: hit[0], g: hit[1], b: hit[2], a: hit[3] };
  }
  const m = raw.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  return m ? { r: Number(m[1]) / 255, g: Number(m[2]) / 255, b: Number(m[3]) / 255, a: m[4] === undefined ? 1 : Number(m[4]) } : null;
};

const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;

describe('pageKit', () => {
  it('runs the same after being sent into the page as text', () => {
    expect(shipped.splitTop('a(b, c), d', ',')).toEqual(['a(b, c)', 'd']);
    expect(shipped.pathText(shipped.pathOps('m1 1 h2'), [1, 0, 0, 1, 0, 0])).toBe('M 1 1 L 3 1');
  });

  it('splits only at the top level, never inside a colour or a function', () => {
    expect(kit.splitTop('linear-gradient(red, rgba(0, 0, 0, 0.5)), url("a,b.png")', ',')).toEqual(['linear-gradient(red, rgba(0, 0, 0, 0.5))', 'url("a,b.png")']);
    expect(kit.splitTop('rgb(1 2 3) 10% 20%', ' ')).toEqual(['rgb(1 2 3)', '10%', '20%']);
  });

  describe('gradientOf', () => {
    it('a top-to-bottom gradient runs from the top centre to the bottom centre', () => {
      const paint = kit.gradientOf('linear-gradient(red, blue)', 200, 100, colour)!;

      expect(paint.type).toBe('GRADIENT_LINEAR');
      expect(paint.gradientHandlePositions[0]).toEqual({ x: 0.5, y: 0 });
      expect(paint.gradientHandlePositions[1]).toEqual({ x: 0.5, y: 1 });
      expect(paint.gradientStops.map((s) => s.position)).toEqual([0, 1]);
      expect(paint.gradientStops[1].color).toEqual({ r: 0, g: 0, b: 1, a: 1 });
    });

    it('to right on a wide box spans the full width', () => {
      const [start, end] = kit.gradientOf('linear-gradient(to right, red, blue)', 400, 100, colour)!.gradientHandlePositions;

      expect(start).toEqual({ x: 0, y: 0.5 });
      expect(end).toEqual({ x: 1, y: 0.5 });
    });

    it('to a corner reaches the corner on a box that is not square', () => {
      const [start, end] = kit.gradientOf('linear-gradient(to bottom right, red, blue)', 400, 100, colour)!.gradientHandlePositions;
      const pixel = (p: { x: number; y: number }) => ({ x: p.x * 400, y: p.y * 100 });
      const [a, b] = [pixel(start), pixel(end)];
      const along = ((400 - a.x) * (b.x - a.x) + (100 - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

      expect(near(along, 1)).toBe(true);
    });

    it('stops without a position spread evenly, pixel stops follow the gradient line', () => {
      const even = kit.gradientOf('linear-gradient(90deg, red, white, blue)', 100, 50, colour)!;
      const pixels = kit.gradientOf('linear-gradient(90deg, red 25px, blue 75%)', 100, 50, colour)!;

      expect(even.gradientStops.map((s) => s.position)).toEqual([0, 0.5, 1]);
      expect(pixels.gradientStops.map((s) => s.position)).toEqual([0.25, 0.75]);
    });

    it('a stop with two positions becomes two stops of the same colour', () => {
      const paint = kit.gradientOf('linear-gradient(90deg, red 0% 40%, blue 40% 100%)', 100, 50, colour)!;

      expect(paint.gradientStops.map((s) => s.position)).toEqual([0, 0.4, 0.4, 1]);
    });

    it('a transparent stop keeps its zero alpha', () => {
      const paint = kit.gradientOf('linear-gradient(transparent, black)', 100, 100, colour)!;

      expect(paint.gradientStops[0].color.a).toBe(0);
    });

    it('a radial gradient keeps its centre and its radii', () => {
      const paint = kit.gradientOf('radial-gradient(circle 50px at 25% 50%, red, blue)', 200, 100, colour)!;

      expect(paint.type).toBe('GRADIENT_RADIAL');
      expect(paint.gradientHandlePositions[0]).toEqual({ x: 0.25, y: 0.5 });
      expect(paint.gradientHandlePositions[1]).toEqual({ x: 0.5, y: 0.5 });
      expect(paint.gradientHandlePositions[2]).toEqual({ x: 0.25, y: 1 });
    });

    it('a radial gradient without a size reaches the farthest corner', () => {
      const paint = kit.gradientOf('radial-gradient(circle, red, blue)', 100, 100, colour)!;
      const reach = (paint.gradientHandlePositions[1].x - 0.5) * 100;

      expect(near(reach, Math.hypot(50, 50))).toBe(true);
    });

    it('a conic gradient keeps its centre and where it starts', () => {
      const paint = kit.gradientOf('conic-gradient(from 90deg at 50% 50%, red, blue)', 100, 100, colour)!;

      expect(paint.type).toBe('GRADIENT_ANGULAR');
      expect(paint.gradientHandlePositions[0]).toEqual({ x: 0.5, y: 0.5 });
      expect(paint.gradientHandlePositions[1]).toEqual({ x: 1, y: 0.5 });
    });

    it('a repeating gradient is not a plain paint', () => {
      expect(kit.gradientOf('repeating-linear-gradient(45deg, red 0 2px, blue 2px 4px)', 100, 100, colour)).toBeNull();
    });
  });

  describe('pathOps', () => {
    it('relative and shorthand commands become absolute lines and curves', () => {
      const d = kit.pathText(kit.pathOps('M10 10 h10 v10 H5 l-5 -5 z'), [1, 0, 0, 1, 0, 0]);

      expect(d).toBe('M 10 10 L 20 10 L 20 20 L 5 20 L 0 15 Z');
    });

    it('a smooth curve mirrors the previous control point', () => {
      const d = kit.pathText(kit.pathOps('M0 0 C 0 10 10 10 10 0 S 20 -10 20 0'), [1, 0, 0, 1, 0, 0]);

      expect(d).toBe('M 0 0 C 0 10 10 10 10 0 C 10 -10 20 -10 20 0');
    });

    it('a quadratic shorthand mirrors its control point', () => {
      const d = kit.pathText(kit.pathOps('M0 0 Q5 10 10 0 T20 0'), [1, 0, 0, 1, 0, 0]);

      expect(d).toBe('M 0 0 Q 5 10 10 0 Q 15 -10 20 0');
    });

    it('an arc becomes curves that end where the arc ends', () => {
      const ops = kit.pathOps('M0 0 A10 10 0 0 1 20 0');
      const last = ops[ops.length - 1];

      expect(ops.slice(1).every((o) => o[0] === 'C')).toBe(true);
      expect(near(last[5] as number, 20) && near(last[6] as number, 0)).toBe(true);
    });

    it('packed arc flags still parse', () => {
      const ops = kit.pathOps('M0 0a5 5 0 1120 0');
      const last = ops[ops.length - 1];

      expect(near(last[5] as number, 20) && near(last[6] as number, 0)).toBe(true);
    });

    it('a move after a close starts from the subpath start', () => {
      const d = kit.pathText(kit.pathOps('M10 10 l5 0 z m5 5 l1 0'), [1, 0, 0, 1, 0, 0]);

      expect(d).toBe('M 10 10 L 15 10 Z M 15 15 L 16 15');
    });

    it('a matrix moves and scales every point', () => {
      expect(kit.pathText(kit.pathOps('M1 2 L3 4'), [2, 0, 0, 2, 10, 20])).toBe('M 12 24 L 16 28');
    });
  });

  describe('shapeD', () => {
    const attrs = (values: Record<string, number | string>) => (name: string) => values[name];

    it('a rounded rectangle is outlined with its corners', () => {
      const ops = kit.pathOps(kit.shapeD('rect', attrs({ x: 0, y: 0, width: 20, height: 10, rx: 2 }))!);
      const xs = ops.flatMap((o) => o.slice(1).filter((_, i) => i % 2 === 0) as number[]);

      expect(Math.min(...xs)).toBeCloseTo(0);
      expect(Math.max(...xs)).toBeCloseTo(20);
      expect(ops.some((o) => o[0] === 'C')).toBe(true);
    });

    it('a circle, a line and a polygon all have geometry', () => {
      expect(kit.shapeD('circle', attrs({ cx: 5, cy: 5, r: 5 }))).toMatch(/^M/);
      expect(kit.shapeD('line', attrs({ x1: 0, y1: 0, x2: 4, y2: 4 }))).toBe('M 0 0 L 4 4');
      expect(kit.shapeD('polygon', attrs({ points: '0,0 4,0 4,4' }))).toBe('M 0 0 L 4 0 L 4 4 Z');
    });
  });

  describe('linesOf', () => {
    it('fragments on the same row are one line, the next row is another', () => {
      const lines = kit.linesOf([
        { left: 0, top: 0, right: 40, bottom: 20 },
        { left: 40, top: 2, right: 80, bottom: 18 },
        { left: 0, top: 24, right: 30, bottom: 44 }
      ]);

      expect(lines).toEqual([
        { left: 0, top: 0, right: 80, bottom: 20 },
        { left: 0, top: 24, right: 30, bottom: 44 }
      ]);
    });
  });
});
