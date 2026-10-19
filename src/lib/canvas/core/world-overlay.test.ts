import { describe, expect, it } from 'vitest';
import { wireCurve } from '$lib/canvas/gpu/geometry';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import { EdgeLook, type CoreTheme } from './overlay';
import { edgeLook, overlayOf, throughCamera } from './world-overlay';

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', paper2: '#f9f9f9', line: '#e5e5e5', line2: '#d2d2d7', chip: '#f2f2f2', chipInk: '#141414', ink: '#1d1d1f', inkSoft: '#6e6e73', accent: '#7c5cff', wire: '#b3b3b6', iterate: '#d97706' };
const edge = (over: Partial<{ id: string; source: string; target: string; mode: string }> = {}) => ({ id: 'e', source: 'a', target: 'b', ...over });
const glyphs = ((text: string, size: number) => ({ contours: [[0, 0, size, 0, size, size]], width: text.length * size, height: size })) as never;
const none = { peers: [], outlines: [], rotate: [], ghost: null, hovered: null, running: [], chrome: [], glyphs };
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
    const items = overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, glyphs, ghost: null, hovered: null, running: [], chrome: [], peers: [{ id: 'p', name: 'Ann', color: '#ff0000', at: { x: 5, y: 5 } }], outlines: [{ key: 'p:n', box: { x: 0, y: 0, w: 10, h: 10 }, color: '#ff0000' }], rotate: [{ id: 'n', box: { x: 0, y: 0, w: 10, h: 10 } }] });
    expect(items.map((i) => i.clip.split(':').at(-1))).toEqual(['peer-outline', 'peer-cursor', 'peer-tag', 'peer-tag', 'rotate', 'rotate']);
  });

  it('draws the wire being dragged on top, in the accent when it can land and in red when refused', () => {
    const ok = overlayOf({ curves: [{ edge: edge(), curve }], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, ghost: { curve, ok: true } });
    const refused = overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, ghost: { curve, ok: false } });
    expect(ok.map((i) => i.clip.split(':').at(-1))).toEqual(['wire', 'ghost']);
    expect(ok.at(-1)!.paint).toMatchObject({ color: [124 / 255, 92 / 255, 1, 1] });
    expect(refused[0].paint).not.toEqual(ok.at(-1)!.paint);
  });

  it('outlines the node under the pointer', () => {
    const items = overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, hovered: { x: 0, y: 0, w: 10, h: 10 } });
    expect(items.map((i) => i.clip.split(':').at(-1))).toEqual(['hover']);
  });

  it('rings every running node in the accent', () => {
    const items = overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, running: [{ id: 'n', x: 0, y: 0, w: 10, h: 10 }] });
    expect(items.map((i) => i.clip)).toEqual(['n:running']);
  });

  it('is placed on screen through the camera', () => {
    const [item] = throughCamera(overlayOf({ curves: [{ edge: edge(), curve }], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 2, theme, ...none }), { x: 10, y: 20, zoom: 2 });
    expect(item.matrix).toEqual([2, 0, 0, 2, 10, 20]);
  });
});

describe('node chrome in the overlay', () => {
  const at = { id: 'n', x: 0, y: 0, width: 100, height: 50, inputs: [], outputs: [], label: null, icon: null, ring: NodeChrome.Selected, handles: true, hovered: false, ringColor: '#7c5cff', names: false };

  it('rings and handles a selected node on top of the wires, every frame', () => {
    const items = overlayOf({ curves: [{ edge: edge(), curve }], selected: ['n'], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, chrome: [at] });
    const parts = [...new Set(items.map((i) => i.clip.split(':')[1]))];

    expect(parts).toEqual(['wire', 'ring', 'handle']);
  });

  it('turns the chrome of a rotated node about its pivot', () => {
    const [ring] = overlayOf({ curves: [], selected: ['n'], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, chrome: [{ ...at, turn: { degrees: 90, about: { x: 50, y: 25 } } }] });

    expect(ring.matrix.map((v) => Math.round(v))).toEqual([0, 1, -1, 0, 75, -25]);
  });
});
