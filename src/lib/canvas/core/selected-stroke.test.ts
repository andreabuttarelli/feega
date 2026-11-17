import { describe, expect, it } from 'vitest';
import type { PathItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import { ChromePart, type Glyphs } from './chrome';
import { ChromeLayers, overlayOf, type WorldOverlay } from './world-overlay';

const GLYPHS: Glyphs = (text, size) => ({ contours: [[0, 0, size * text.length * 0.5, 0, size * text.length * 0.5, size, 0, size]], width: size * text.length * 0.5, height: size });

const FRAME = { x: 100, y: 50, w: 400, h: 300 };
const HELD_ZOOM = 1;
const PX_SLACK = 1e-6;

const THEME = { paper: '#ffffff', line: '#e5e5e5', panel: '#ffffff', ink: '#111111', accent: '#ff6a3d' } as never;

const overlay = (): WorldOverlay => ({
  curves: [],
  selected: ['f'],
  selectedEdge: null,
  marquee: null,
  guides: [],
  zoom: HELD_ZOOM,
  theme: THEME,
  glyphs: GLYPHS,
  peers: [],
  outlines: [],
  ghost: null,
  running: [],
  chrome: [{ id: 'f', x: FRAME.x, y: FRAME.y, width: FRAME.w, height: FRAME.h, inputs: [], outputs: [], label: 'Landing 1440', icon: null, tag: null, zoom: HELD_ZOOM, ring: NodeChrome.Selected, handles: true, ringColor: '#000', names: false, strokeZoom: HELD_ZOOM, radius: 0, layers: ChromeLayers.Whole }]
});

const onScreen = (item: PathItem, zoom: number) => item.contours.flatMap((c, j) => c.map((v, i) => (v + (item.nudge?.[j][i] ?? 0) / zoom) * zoom));

function span(items: readonly PathItem[], part: ChromePart, zoom: number) {
  const xs = items.filter((i) => i.clip.endsWith(`:${part}`)).flatMap((i) => onScreen(i, zoom).filter((_, k) => k % 2 === 0));
  return { left: FRAME.x * zoom - Math.min(...xs), width: Math.max(...xs) - Math.min(...xs) };
}

describe('the overlay pinned to its frames', () => {
  it('keeps ring, handles and label the same size on screen at every zoom without a new overlay', () => {
    const { fixed, selected } = overlayOf(overlay());
    const items = [...fixed, ...selected];
    const at = (zoom: number) => ({ ring: span(items, ChromePart.Ring, zoom).left, handle: span(items, ChromePart.Handle, zoom).left, label: span(items, ChromePart.Label, zoom).width });
    const base = at(HELD_ZOOM);

    for (const zoom of [0.3, 0.6, 2, 4]) {
      const now = at(zoom);
      expect(Math.abs(now.ring - base.ring)).toBeLessThan(PX_SLACK);
      expect(Math.abs(now.handle - base.handle)).toBeLessThan(PX_SLACK);
      expect(Math.abs(now.label - base.label)).toBeLessThan(PX_SLACK);
    }
  });
});
