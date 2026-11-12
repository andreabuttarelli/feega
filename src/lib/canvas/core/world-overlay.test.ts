import { describe, expect, it, vi } from 'vitest';
import { wireCurve } from '$lib/canvas/gpu/geometry';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import { EdgeLook, type CoreTheme } from './overlay';
import { ChromeLayers, edgeLook, overlayOf as parts, type WorldOverlay } from './world-overlay';
import { PortState } from './chrome';

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', paper2: '#f9f9f9', line: '#e5e5e5', line2: '#d2d2d7', chip: '#f2f2f2', chipInk: '#141414', ink: '#1d1d1f', inkSoft: '#6e6e73', accent: '#7c5cff', wire: '#b3b3b6', iterate: '#d97706' };
const edge = (over: Partial<{ id: string; source: string; target: string; mode: string }> = {}) => ({ id: 'e', source: 'a', target: 'b', ...over });
const glyphs = ((text: string, size: number) => ({ contours: [[0, 0, size, 0, size, size]], width: text.length * size, height: size })) as never;
const none = { peers: [], outlines: [], ghost: null, running: [], chrome: [], glyphs };
const overlayOf = (o: WorldOverlay) => {
  const { fixed, selected, live } = parts(o);
  return [...fixed, ...selected, ...live];
};
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

  it('adds peers outlines and cursors, on top', () => {
    const items = overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, glyphs, ghost: null, running: [], chrome: [], peers: [{ id: 'p', name: 'Ann', color: '#ff0000', at: { x: 5, y: 5 } }], outlines: [{ key: 'p:n', box: { x: 0, y: 0, w: 10, h: 10 }, color: '#ff0000' }] });
    expect(items.map((i) => i.clip.split(':').at(-1))).toEqual(['peer-outline', 'peer-cursor', 'peer-tag', 'peer-tag']);
  });

  it('draws the wire being dragged on top, in the accent when it can land and in red when refused', () => {
    const ok = overlayOf({ curves: [{ edge: edge(), curve }], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, ghost: { curve, ok: true } });
    const refused = overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, ghost: { curve, ok: false } });
    expect(ok.map((i) => i.clip.split(':').at(-1))).toEqual(['wire', 'ghost']);
    expect(ok.at(-1)!.paint).toMatchObject({ color: [124 / 255, 92 / 255, 1, 1] });
    expect(refused[0].paint).not.toEqual(ok.at(-1)!.paint);
  });

  it('rings every running node in the accent', () => {
    const items = overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, running: [{ id: 'n', x: 0, y: 0, w: 10, h: 10 }] });
    expect(items.map((i) => i.clip)).toEqual(['n:running']);
  });
});

describe('node chrome in the overlay', () => {
  const at = { id: 'n', x: 0, y: 0, width: 100, height: 50, inputs: [], outputs: [], label: null, icon: null, ring: NodeChrome.Selected, handles: true, ringColor: '#7c5cff', names: false };

  it('rings and handles a selected node on top of the wires, every frame', () => {
    const items = overlayOf({ curves: [{ edge: edge(), curve }], selected: ['n'], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, chrome: [at] });
    const parts = [...new Set(items.map((i) => i.clip.split(':')[1]))];

    expect(parts).toEqual(['wire', 'ring', 'handle']);
  });

  it('keeps a frame label and ports in the overlay when its layers are whole', () => {
    const frame = { ...at, ring: NodeChrome.None, handles: false, label: 'Hero', outputs: [{ type: 'text', state: PortState.Quiet }], layers: ChromeLayers.Whole } as never;
    const items = overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, chrome: [frame] });

    expect(items.length).toBeGreaterThan(0);
    expect(overlayOf({ curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, chrome: [{ ...(frame as object), layers: ChromeLayers.State } as never] })).toHaveLength(0);
  });

  it('keeps the port dots of a selected node the DOM draws, without its label or ring', () => {
    const selected = { ...at, ring: NodeChrome.None, handles: false, label: 'Generate image', inputs: [{ type: 'text', state: PortState.Quiet }], outputs: [{ type: 'images', state: PortState.Quiet }], layers: ChromeLayers.Ports } as never;
    const items = overlayOf({ curves: [], selected: ['n'], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, chrome: [selected] });

    expect(items.map((i) => i.clip.split(':').pop())).toEqual(['port-in', 'port-out']);
  });

  it('turns the chrome of a rotated node about its pivot', () => {
    const [ring] = overlayOf({ curves: [], selected: ['n'], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none, chrome: [{ ...at, turn: { degrees: 90, about: { x: 50, y: 25 } } }] });

    expect(ring.matrix.map((v) => Math.round(v))).toEqual([0, 1, -1, 0, 75, -25]);
  });
});

describe('world overlay across zoom', () => {
  it('keeps the wire and chrome items when only the zoom changes', () => {
    const base = { curves: [{ edge: edge(), curve }], selected: [], selectedEdge: null, marquee: { x: 0, y: 0, w: 10, h: 10 }, guides: [], theme, ...none };
    const near = overlayOf({ ...base, zoom: 1 });
    const far = overlayOf({ ...base, zoom: 0.5 });

    expect(far[0]).toBe(near[0]);
    expect(far.at(-1)).not.toBe(near.at(-1));
  });

  it('hands back the same fixed part and a new live part when only the zoom changes', () => {
    const base = { curves: [{ edge: edge(), curve }], selected: [], selectedEdge: null, marquee: { x: 0, y: 0, w: 10, h: 10 }, guides: [], theme, ...none };
    const near = parts({ ...base, zoom: 1 });
    const far = parts({ ...base, zoom: 0.5 });

    expect(far.fixed).toBe(near.fixed);
    expect(far.fixed.map((i) => i.clip.split(':')[1])).toEqual(['wire']);
    expect(far.live.map((i) => i.clip.split(':').at(-1))).toEqual(['marquee', 'marquee']);
  });
});

describe('world overlay, node by node', () => {
  const tile = (id: string, x: number) => ({ id, x, y: 0, width: 100, height: 50, inputs: [], outputs: [], label: null, icon: null, ring: NodeChrome.Selected, handles: true, ringColor: '#7c5cff', names: false });

  it('keeps the chrome items of a node that did not change when another one does', () => {
    const base = { curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none };
    const before = parts({ ...base, chrome: [tile('a', 0), tile('b', 200)] });
    const after = parts({ ...base, chrome: [tile('a', 0), tile('b', 300)] });

    expect(after.fixed[0]).toBe(before.fixed[0]);
    expect(after.fixed.at(-1)).not.toBe(before.fixed.at(-1));
  });

  it('moving a selected node hands back the same fixed part and a new selected part', () => {
    const base = { curves: [{ edge: edge({ source: 'b', target: 'c' }), curve }, { edge: edge({ id: 'f', source: 'a', target: 'c' }), curve }], selected: ['b'], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none };
    const before = parts({ ...base, chrome: [tile('a', 0), tile('b', 200)] });
    const after = parts({ ...base, curves: [{ edge: edge({ source: 'b', target: 'c' }), curve: { ...curve } }, base.curves[1]], chrome: [tile('a', 0), tile('b', 300)] });

    expect(after.fixed).toBe(before.fixed);
    expect(after.selected).not.toBe(before.selected);
    expect(after.selected.map((i) => i.clip.split(':')[0])).toContain('b');
    expect(after.fixed.some((i) => i.clip.startsWith('b:'))).toBe(false);
  });

  it('a zoom frame that rebuilds equal chrome compares it without serialising', () => {
    const base = { curves: [{ edge: edge(), curve }], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none };
    parts({ ...base, chrome: [tile('a', 0), tile('b', 200)] });
    const serialised = vi.spyOn(JSON, 'stringify');
    const again = parts({ ...base, curves: [{ edge: edge(), curve: { ...curve } }], chrome: [tile('a', 0), tile('b', 200)] });
    const calls = serialised.mock.calls.length;
    serialised.mockRestore();

    expect(again.fixed.length).toBeGreaterThan(0);
    expect(calls).toBe(0);
  });
});

describe('world overlay across stroke zoom steps', () => {
  const frame = (strokeZoom: number, ring = NodeChrome.None) => ({ id: 'f', x: 0, y: 0, width: 400, height: 300, inputs: [], outputs: [{ type: 'text', state: PortState.Quiet }], label: 'Hero', icon: null, tag: '#ff0000', zoom: 1, ring, handles: ring === NodeChrome.Selected, ringColor: '#7c5cff', names: false, strokeZoom, layers: ChromeLayers.Whole }) as never;
  const base = { curves: [], selected: [], selectedEdge: null, marquee: null, guides: [], zoom: 1, theme, ...none };

  it('hands back the same fixed part when no node draws a ring', () => {
    const before = parts({ ...base, chrome: [frame(1)] });
    const after = parts({ ...base, chrome: [frame(1.04)] });

    expect(after.fixed).toBe(before.fixed);
  });

  it('builds again only the ring and handles of a selected node, not its label and ports', () => {
    const before = parts({ ...base, selected: ['f'], chrome: [frame(1, NodeChrome.Selected)] });
    const after = parts({ ...base, selected: ['f'], chrome: [frame(1.04, NodeChrome.Selected)] });
    const kept = (clip: string) => after.selected.find((i) => i.clip === clip) === before.selected.find((i) => i.clip === clip);

    expect(kept('f:label')).toBe(true);
    expect(kept('f:port-out')).toBe(true);
    expect(kept('f:ring')).toBe(false);
  });
});
