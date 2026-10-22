import { describe, expect, it } from 'vitest';
import { strokesSchema } from './model';
import { strokeReach, svgStrokes, textStroke } from './render';

const paint = { id: 'a', size: { w: 200, h: 100 }, unit: 1000, color: (v: string) => (v.startsWith('#') ? v : `resolved(${v})`) };
const PATHS = '<path d="M0 0L200 0L200 100L0 100Z"/>';
const stack = (raw: unknown[]) => strokesSchema.parse(raw);
const solid = (extra: Record<string, unknown> = {}) => ({ paint: { type: 'solid', color: '#111111' }, ...extra });

describe('stroke miter limit', () => {
  it('a non-default miter limit reaches the svg', () => {
    expect(svgStrokes(stack([solid({ miter: 10 })]), paint, PATHS).body).toContain('stroke-miterlimit:10');
  });

  it('the default miter limit stays implicit', () => {
    expect(svgStrokes(stack([solid()]), paint, PATHS).body).not.toContain('miterlimit');
  });
});

describe('stroke stack in svg', () => {
  it('a centred stroke draws on the outline in frame units', () => {
    const { body } = svgStrokes(stack([solid({ width: 0.01, dash: 0.02, gap: 0.01, cap: 'round', join: 'bevel' })]), paint, PATHS);
    expect(body).toBe(`<g style="fill:none;stroke:#111111;stroke-width:10;stroke-linecap:round;stroke-linejoin:bevel;stroke-dasharray:20 10">${PATHS}</g>`);
  });

  it('an inside stroke doubles its width and clips to the shape', () => {
    const { defs, body } = svgStrokes(stack([solid({ align: 'inside' })]), paint, PATHS);
    expect(defs).toContain(`<clipPath id="sk-a-s0">${PATHS}</clipPath>`);
    expect(body).toContain('stroke-width:20');
    expect(body).toContain('clip-path="url(#sk-a-s0)"');
  });

  it('an outside stroke doubles its width and masks the inside out', () => {
    const { defs, body } = svgStrokes(stack([solid({ align: 'outside' })]), paint, PATHS);
    expect(defs).toContain('<mask id="sk-a-s0"');
    expect(defs).toContain('fill:#000000');
    expect(body).toContain('stroke-width:20');
    expect(body).toContain('mask="url(#sk-a-s0)"');
  });

  it('strokes paint bottom to top, hidden ones skipped', () => {
    const { body } = svgStrokes(stack([solid(), { paint: { type: 'solid', color: '#222222' } }, { paint: { type: 'solid', color: '#333333' }, visible: false }]), paint, PATHS);
    expect(body.indexOf('#111111')).toBeLessThan(body.indexOf('#222222'));
    expect(body).not.toContain('#333333');
  });

  it('a gradient stroke points along its angle, its own gradient id', () => {
    const { defs, body } = svgStrokes(stack([{ paint: { type: 'linear-gradient', angle: 0, stops: [{ color: 'brand.accent', pos: 0 }, { color: '#000000', pos: 1 }] } }]), paint, PATHS);
    expect(defs).toContain('<linearGradient id="sg-a-s-f0" gradientUnits="userSpaceOnUse" x1="0" y1="50" x2="200" y2="50">');
    expect(defs).toContain('stop-color:resolved(brand.accent)');
    expect(body).toContain('stroke:url(#sg-a-s-f0)');
  });

  it('paint opacity and blend reach the stroke layer', () => {
    const { body } = svgStrokes(stack([{ paint: { type: 'solid', color: '#111111', opacity: 0.5, blend: 'multiply' } }]), paint, PATHS);
    expect(body).toContain('mix-blend-mode:multiply');
    expect(body).toContain('opacity="0.5"');
  });

  it('per-side widths draw a frame of the box, each side its own width', () => {
    const { body } = svgStrokes(stack([solid({ align: 'inside', sides: [0.01, 0, 0.02, 0] })]), paint, PATHS, { sided: true });
    expect(body).toContain('<path d="M0 0H200V100H0Z M0 10H200V80H0Z" style="fill:#111111;fill-rule:evenodd;stroke:none"/>');
  });

  it('per-side widths are ignored on a shape that has no sides', () => {
    const { body } = svgStrokes(stack([solid({ sides: [0.01, 0, 0.02, 0] })]), paint, PATHS, { sided: false });
    expect(body).toContain('stroke-width:10');
  });

  it('reach grows with alignment: none inside, half centred, all outside', () => {
    expect(strokeReach(stack([solid({ align: 'inside', width: 0.01 })]), 1000)).toBe(0);
    expect(strokeReach(stack([solid({ width: 0.01 })]), 1000)).toBe(20);
    expect(strokeReach(stack([solid({ align: 'outside', width: 0.01 })]), 1000)).toBe(40);
  });

  it('text takes its first visible stroke: centred as is, outside drawn behind the fill at double width', () => {
    expect(textStroke(stack([solid({ width: 0.002 })]), 1000, paint.color)).toEqual({ WebkitTextStroke: '2px #111111' });
    expect(textStroke(stack([solid({ width: 0.002, align: 'outside' })]), 1000, paint.color)).toEqual({ WebkitTextStroke: '4px #111111', paintOrder: 'stroke fill' });
    expect(textStroke(stack([{ paint: { type: 'linear-gradient', stops: [{ color: 'brand.accent', pos: 0 }, { color: '#000', pos: 1 }] } }]), 1000, paint.color)).toEqual({ WebkitTextStroke: '10px resolved(brand.accent)' });
    expect(textStroke([], 1000, paint.color)).toEqual({});
  });
});
