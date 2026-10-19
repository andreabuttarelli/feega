import { describe, expect, it } from 'vitest';
import { rgbaOf } from '$lib/motion/gpu-full/rgba';
import { wireCurve } from '$lib/canvas/gpu/geometry';
import { EdgeLook, OverlayPart, edgeItems, guideItems, marqueeItems, peerItems, rotateItems, type CoreTheme } from './overlay';
import type { Glyphs } from './chrome';

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', paper2: '#f9f9f9', line: '#e5e5e5', line2: '#d2d2d7', chip: '#f2f2f2', chipInk: '#141414', ink: '#1d1d1f', inkSoft: '#6e6e73', accent: '#7c5cff', wire: '#b3b3b6', iterate: '#d97706' };
const glyphs: Glyphs = (text, size) => ({ contours: [[0, 0, text.length * size, 0, text.length * size, size, 0, size]], width: text.length * size, height: size });

const box = (contours: number[][]) => {
  const xs = contours.flatMap((c) => c.filter((_, i) => i % 2 === 0));
  const ys = contours.flatMap((c) => c.filter((_, i) => i % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v) + 0);
};
const colour = (i: { paint: unknown }) => (i.paint as { color: number[] }).color;

describe('edgeItems', () => {
  const curve = wireCurve({ x: 0, y: 0 }, { x: 200, y: 100 });

  it('strokes a plain wire 1px wide, end to end, in the wire colour', () => {
    const [wire] = edgeItems('e1', curve, EdgeLook.Plain, theme);

    expect(box(wire.contours)).toEqual([0, 0, 200, 100]);
    expect(colour(wire)).toEqual(rgbaOf(theme.wire));
  });

  it('darkens a wire whose node is selected', () => {
    expect(colour(edgeItems('e1', curve, EdgeLook.Linked, theme)[0])).toEqual(rgbaOf(theme.inkSoft));
  });

  it('dashes an iterate wire and badges its midpoint', () => {
    const items = edgeItems('e1', curve, EdgeLook.Iterate, theme);
    const badges = items.filter((i) => i.clip === `e1:${OverlayPart.Badge}`);

    expect(items.filter((i) => i.clip === `e1:${OverlayPart.Wire}`).length).toBeGreaterThan(1);
    expect(box(badges[0].contours)).toEqual([89, 39, 111, 61]);
  });
});

describe('marqueeItems', () => {
  it('fills the box faintly and outlines it in the accent', () => {
    const [fill, edge] = marqueeItems({ x: 10, y: 20, w: 100, h: 50 }, 1, theme);

    expect(fill.opacity).toBe(0.08);
    expect(box(fill.contours)).toEqual([10, 20, 110, 70]);
    expect(colour(edge)).toEqual(rgbaOf(theme.accent));
  });
});

describe('guideItems', () => {
  it('draws a vertical snap guide along its span', () => {
    const [g] = guideItems([{ axis: 'x', at: 50, from: 0, to: 300 }], 1, theme);

    expect(box(g.contours)).toEqual([50, 0, 51, 300]);
  });
});

describe('peerItems', () => {
  it('draws the cursor arrow and a name pill at 1/zoom', () => {
    const items = peerItems({ id: 'p', name: 'Ada', color: '#ff0000', at: { x: 100, y: 100 } }, 2, glyphs);
    const pill = items.find((i) => i.clip === `p:${OverlayPart.PeerTag}`)!;

    expect(box(items[0].contours)).toEqual([100, 100, 106, 108]);
    expect(box(pill.contours)).toEqual([105, 108, 127, 117]);
  });
});

describe('rotateItems', () => {
  it('centres a 12px knob 28px above the tile', () => {
    const [ring] = rotateItems('n', { x: 0, y: 100, w: 200, h: 50 }, theme);

    expect(box(ring.contours)).toEqual([94, 72, 106, 84]);
  });
});
