import { describe, expect, it } from 'vitest';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import { CONNECTOR_STYLE } from '$lib/canvas/connectors';
import { rgbaOf } from '$lib/motion/gpu-full/rgba';
import { PaintKind } from '$lib/motion/gpu-full/paint';
import { tileChrome, ChromePart, type ChromeTile, type Glyphs } from './chrome';

const box = (contours: number[][]) => {
  const xs = contours.flatMap((c) => c.filter((_, i) => i % 2 === 0));
  const ys = contours.flatMap((c) => c.filter((_, i) => i % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v));
};

const glyphs: Glyphs = (text, size) => ({ contours: [[0, -size, text.length * size, -size, text.length * size, 0, 0, 0]], width: text.length * size });

const tile = (over: Partial<ChromeTile> = {}): ChromeTile => ({
  id: 'n1',
  x: 100,
  y: 200,
  width: 300,
  height: 150,
  ring: NodeChrome.None,
  handles: false,
  hovered: false,
  ringColor: '#7c5cff',
  inputs: [],
  output: null,
  label: null,
  ...over
});

const parts = (t: ChromeTile) => tileChrome(t, glyphs);
const ofPart = (t: ChromeTile, part: ChromePart) => parts(t).filter((i) => i.clip === `n1:${part}`);

describe('tileChrome', () => {
  it('draws nothing for an idle tile without ports or label', () => {
    expect(parts(tile())).toEqual([]);
  });

  it('rings a selected tile 2px outside its box, offset by 1px, in the ring colour', () => {
    const [ring] = ofPart(tile({ ring: NodeChrome.Selected }), ChromePart.Ring);

    expect(box(ring.contours)).toEqual([97, 197, 403, 353]);
    expect(ring.paint).toEqual({ kind: PaintKind.Solid, color: rgbaOf('#7c5cff') });
  });

  it('draws the editing ring dashed at half opacity', () => {
    const rings = ofPart(tile({ ring: NodeChrome.Editing }), ChromePart.Ring);

    expect(rings.length).toBeGreaterThan(1);
    expect(rings.every((r) => r.opacity === 0.5)).toBe(true);
  });

  it('outlines a hovered tile only while it is not selected', () => {
    expect(ofPart(tile({ hovered: true }), ChromePart.Hover)).toHaveLength(1);
    expect(ofPart(tile({ hovered: true, ring: NodeChrome.Selected }), ChromePart.Hover)).toHaveLength(0);
  });

  it('spaces input ports evenly on the left edge, outside the box, in their connector colour', () => {
    const ports = ofPart(tile({ inputs: ['text', 'images'] }), ChromePart.PortIn);

    expect(ports.map((p) => box(p.contours))).toEqual([
      [90, 245, 100, 255],
      [90, 295, 100, 305]
    ]);
    expect(ports[1].paint).toEqual({ kind: PaintKind.Solid, color: rgbaOf(CONNECTOR_STYLE.images.color) });
  });

  it('centres the output port on the right edge', () => {
    const [port] = ofPart(tile({ output: 'videos' }), ChromePart.PortOut);

    expect(box(port.contours)).toEqual([400, 270, 410, 280]);
  });

  it('puts four bordered corner handles on a selected resizable tile', () => {
    expect(ofPart(tile({ ring: NodeChrome.Selected, handles: true }), ChromePart.Handle)).toHaveLength(8);
    expect(ofPart(tile({ ring: NodeChrome.Selected }), ChromePart.Handle)).toHaveLength(0);
  });

  it('writes the label above the tile, left-aligned, 4px clear of the top edge', () => {
    const [label] = ofPart(tile({ label: 'Image' }), ChromePart.Label);

    expect(box(label.contours)).toEqual([100, 184, 160, 196]);
  });

  it('draws chrome above the ring order: hover, ring, ports, handles, label', () => {
    const order = parts(tile({ ring: NodeChrome.Selected, handles: true, inputs: ['text'], output: 'text', label: 'Text' })).map((i) => i.clip.split(':')[1]);

    expect([...new Set(order)]).toEqual([ChromePart.Ring, ChromePart.PortIn, ChromePart.PortOut, ChromePart.Handle, ChromePart.Label]);
  });
});
