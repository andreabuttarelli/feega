import { describe, expect, it } from 'vitest';
import { DEFAULT_MESH, addPoint, cssOf, handlesOf, movePoint, parseMesh, randomize, removePoint, setColor, setSoftness, treeOf, type Mesh } from './mesh';
import { Control } from '@feega/plugin-api/protocol';

const MESH: Mesh = {
  base: '#101018',
  softness: 60,
  points: [
    { id: 'p1', x: 0.2, y: 0.3, color: '#ff0000' },
    { id: 'p2', x: 0.8, y: 0.7, color: '#0000ff' }
  ]
};

describe('cssOf', () => {
  it('stacks one radial gradient per point over the base colour', () => {
    const css = cssOf(MESH);
    expect(css['background-color']).toBe('#101018');
    expect(css['background-image']).toBe('radial-gradient(circle at 20% 30%, #ff0000 0%, #ff000000 72%), radial-gradient(circle at 80% 70%, #0000ff 0%, #0000ff00 72%)');
  });

  it('spreads wider as softness grows', () => {
    const tight = cssOf({ ...MESH, softness: 0 })['background-image'];
    const loose = cssOf({ ...MESH, softness: 100 })['background-image'];
    expect(tight).toContain('#ff000000 30%');
    expect(loose).toContain('#ff000000 100%');
  });

  it('is plain CSS with no custom properties or functions beyond radial-gradient', () => {
    const css = Object.values(cssOf(MESH)).join(' ');
    expect(css).not.toMatch(/var\(|calc\(|url\(|@/);
  });

  it('rounds positions to whole percents', () => {
    const css = cssOf({ ...MESH, points: [{ id: 'a', x: 0.123456, y: 0.987654, color: '#00ff00' }] });
    expect(css['background-image']).toContain('circle at 12% 99%');
  });
});

describe('parseMesh', () => {
  it('reads back what cssOf wrote, as the browser reports it', () => {
    const computed = {
      'background-color': 'rgb(16, 16, 24)',
      'background-image': 'radial-gradient(circle at 20% 30%, rgb(255, 0, 0) 0%, rgba(255, 0, 0, 0) 72%), radial-gradient(circle at 80% 70%, rgb(0, 0, 255) 0%, rgba(0, 0, 255, 0) 72%)'
    };
    const mesh = parseMesh(computed);
    expect(mesh).toMatchObject({ base: '#101018', softness: 60 });
    expect(mesh?.points.map(({ x, y, color }) => ({ x, y, color }))).toEqual([
      { x: 0.2, y: 0.3, color: '#ff0000' },
      { x: 0.8, y: 0.7, color: '#0000ff' }
    ]);
  });

  it('reads the source form too', () => {
    const mesh = parseMesh({ 'background-color': '#101018', 'background-image': cssOf(MESH)['background-image'] });
    expect(mesh?.points).toHaveLength(2);
    expect(mesh?.points[0].color).toBe('#ff0000');
  });

  it('gives null when the element has no gradient', () => {
    expect(parseMesh({ 'background-image': 'none', 'background-color': 'rgba(0, 0, 0, 0)' })).toBeNull();
    expect(parseMesh({})).toBeNull();
  });

  it('gives null for a gradient that is not ours', () => {
    expect(parseMesh({ 'background-image': 'linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)' })).toBeNull();
    expect(parseMesh({ 'background-image': 'url("a.png")' })).toBeNull();
  });

  it('round-trips', () => {
    const back = parseMesh({ 'background-color': cssOf(MESH)['background-color'], 'background-image': cssOf(MESH)['background-image'] });
    expect(cssOf(back!)).toEqual(cssOf(MESH));
  });
});

describe('editing', () => {
  it('moves a point and keeps it inside the box', () => {
    const moved = movePoint(MESH, 'p1', 1.4, -0.2);
    expect(moved.points[0]).toMatchObject({ x: 1, y: 0 });
    expect(MESH.points[0].x).toBe(0.2);
  });

  it('sets a colour as lowercase hex', () => {
    expect(setColor(MESH, 'p2', '#ABCDEF').points[1].color).toBe('#abcdef');
  });

  it('expands three-digit hex', () => {
    expect(setColor(MESH, 'p2', '#0af').points[1].color).toBe('#00aaff');
  });

  it('ignores a colour it cannot read', () => {
    expect(setColor(MESH, 'p2', 'salmon')).toEqual(MESH);
  });

  it('clamps softness to 0..100', () => {
    expect(setSoftness(MESH, 250).softness).toBe(100);
    expect(setSoftness(MESH, -5).softness).toBe(0);
  });

  it('adds a point with a fresh id', () => {
    const grown = addPoint(MESH, () => 0.5);
    expect(grown.points).toHaveLength(3);
    expect(new Set(grown.points.map((p) => p.id)).size).toBe(3);
  });

  it('removes a point but never the last one', () => {
    expect(removePoint(MESH, 'p1').points.map((p) => p.id)).toEqual(['p2']);
    expect(removePoint(removePoint(MESH, 'p1'), 'p2').points).toHaveLength(1);
  });

  it('randomizes positions and colours but keeps the count and ids', () => {
    let n = 0;
    const rng = () => ((n += 0.137) % 1);
    const mixed = randomize(MESH, rng);
    expect(mixed.points.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(mixed.points[0]).not.toEqual(MESH.points[0]);
    for (const p of mixed.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('starts from a sensible default', () => {
    expect(DEFAULT_MESH.points.length).toBeGreaterThanOrEqual(3);
  });
});

describe('treeOf and handlesOf', () => {
  it('lists the points, the selected colour, softness, base and actions', () => {
    const tree = treeOf(MESH, 'p2');
    const types = tree.map((n) => n.type);
    expect(types).toEqual([Control.List, Control.Colour, Control.Slider, Control.Colour, Control.Button, Control.Button, Control.Button]);
    expect(tree[0]).toMatchObject({ id: 'points', selected: 'p2', items: [{ id: 'p1', swatch: '#ff0000' }, { id: 'p2', swatch: '#0000ff' }] });
    expect(tree[1]).toMatchObject({ id: 'color', value: '#0000ff' });
    expect(tree[2]).toMatchObject({ id: 'softness', value: 60 });
  });

  it('puts one handle on each point', () => {
    expect(handlesOf(MESH, 'p1')).toEqual([
      { id: 'p1', x: 0.2, y: 0.3, color: '#ff0000', selected: true },
      { id: 'p2', x: 0.8, y: 0.7, color: '#0000ff', selected: false }
    ]);
  });
});
