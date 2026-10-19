import { describe, expect, it } from 'vitest';
import { wireCurve } from '$lib/canvas/gpu/geometry';
import { EdgeLook, type CoreTheme } from './overlay';
import { edgeLook, overlayOf, throughCamera } from './world-overlay';

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', line: '#e5e5e5', ink: '#1d1d1f', inkSoft: '#6e6e73', accent: '#7c5cff', wire: '#b3b3b6', iterate: '#d97706' };
const edge = (over: Partial<{ id: string; source: string; target: string; mode: string }> = {}) => ({ id: 'e', source: 'a', target: 'b', ...over });
const glyphs = ((text: string, size: number) => ({ contours: [[0, 0, size, 0, size, size]], width: text.length * size, height: size })) as never;
const none = { peers: [], outlines: [], rotate: [], glyphs };
const curve = wireCurve({ x: 0, y: 0 }, { x: 100, y: 50 });

describe('edge look', () => {
  it('a wire is plain, linked when an end or the wire is selected, iterate above both', () => {
    expect(edgeLook(edge(), [], null)).toBe(EdgeLook.Plain);
    expect(edgeLook(edge(), ['a'], null)).toBe(EdgeLook.Linked);
    expect(edgeLook(edge(), [], 'e')).toBe(EdgeLook.Linked);
    expect(edgeLook(edge({ mode: 'iterate' }), ['a'], 'e')).toBe(EdgeLook.Iterate);
  });
});

describe('world overlay', () => {
  it('holds wires, then the marquee, then guides', () => {
    const items = overlayOf({ curves: [{ edge: edge(), curve }], selected: [], selectedEdge: null, marquee: { x: 0, y: 0, w: 10, h: 10 }, guides: [{ axis: 'x', at: 5, from: 0, to: 10 }] as never, zoom: 1, theme, ...none });
    expect(items.map((i) => i.clip.split(':')[1])).toEqual(['wire', 'marquee', 'marquee', 'guide']);
  });

  it('adds peers outlines and cursors, then rotate knobs, on top', () => {
    const items = overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, glyphs, peers: [{ id: 'p', name: 'Ann', color: '#ff0000', at: { x: 5, y: 5 } }], outlines: [{ key: 'p:n', box: { x: 0, y: 0, w: 10, h: 10 }, color: '#ff0000' }], rotate: [{ id: 'n', box: { x: 0, y: 0, w: 10, h: 10 } }] });
    expect(items.map((i) => i.clip.split(':').at(-1))).toEqual(['peer-outline', 'peer-cursor', 'peer-tag', 'peer-tag', 'rotate', 'rotate']);
  });

  it('is placed on screen through the camera', () => {
    const [item] = throughCamera(overlayOf({ curves: [{ edge: edge(), curve }], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 2, theme, ...none }), { x: 10, y: 20, zoom: 2 });
    expect(item.matrix).toEqual([2, 0, 0, 2, 10, 20]);
  });
});
