import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../components';
import { ModifierKind } from './modifiers';
import { shapeMarkup, type Paint, type ShapeLook } from './render';

const look = (patch: Record<string, unknown> = {}) => COMPONENTS.Shape.schema.parse({ shape: 'rect', ...patch }) as unknown as ShapeLook;
const paint: Paint = { id: 'a', size: { w: 200, h: 100 }, unit: 1000, time: 0, color: (v) => (v.startsWith('#') ? v : `resolved(${v})`) };

describe('shape markup', () => {
  it('a solid rectangle is one path filling the box', () => {
    const svg = shapeMarkup(look({ fill: '#ff0000' }), paint);
    expect(svg).toContain('<path d="M0 0L200 0L200 100L0 100Z"/>');
    expect(svg).toContain('fill:#ff0000');
    expect(svg).toContain('stroke:none');
  });

  it('a linear gradient fill points along its angle, colours resolved', () => {
    const svg = shapeMarkup(look({ fillKind: 'linear', gradientAngle: 0, fill: 'brand.accent', fill2: '#000000' }), paint);
    expect(svg).toContain('<linearGradient id="sg-a" gradientUnits="userSpaceOnUse" x1="0" y1="50" x2="200" y2="50">');
    expect(svg).toContain('stop-color:resolved(brand.accent)');
    expect(svg).toContain('fill:url(#sg-a)');
  });

  it('a stroke carries width, dash, caps and joins in frame units', () => {
    const svg = shapeMarkup(look({ fillKind: 'none', strokeKind: 'solid', stroke: '#111111', strokeWidth: 0.01, dash: 0.02, gap: 0.01, cap: 'round', join: 'bevel' }), paint);
    expect(svg).toContain('stroke:#111111;stroke-width:10;stroke-linecap:round;stroke-linejoin:bevel;stroke-dasharray:20 10');
  });

  it('a path shape scales its 0..1 data to the box', () => {
    expect(shapeMarkup(look({ shape: 'path', path: 'M0 0L1 1' }), paint)).toContain('d="M0 0L200 100"');
  });

  it('a repeater draws one path per copy with its transform and opacity', () => {
    const svg = shapeMarkup(look({ modifiers: [{ id: 'r', kind: ModifierKind.Repeater, params: { copies: 3, offsetX: 1, endOpacity: 0 } }] }), paint);
    expect(svg.match(/<path /g)).toHaveLength(3);
    expect(svg).toContain('transform="matrix(1 0 0 1 400 0)" opacity="0"');
  });

  it('a disabled modifier changes nothing', () => {
    expect(shapeMarkup(look({ modifiers: [{ id: 't', kind: ModifierKind.Trim, enabled: false, params: { end: 0 } }] }), paint)).toBe(shapeMarkup(look(), paint));
  });

  it('morph 1 draws the first morph target', () => {
    const svg = shapeMarkup(look({ morphs: ['M0 0L1 0L1 1L0 1Z'], morph: 1 }), paint);
    expect(svg).toContain('<path d="M0 0L');
  });
});
