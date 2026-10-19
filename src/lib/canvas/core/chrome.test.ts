import { describe, expect, it } from 'vitest';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import { CONNECTOR_STYLE } from '$lib/canvas/connectors';
import { rgbaOf } from '$lib/motion/gpu-full/rgba';
import { FillRule, PaintKind } from '$lib/motion/gpu-full/paint';
import { tileChrome, ChromePart, PortState, type ChromeTile, type Glyphs } from './chrome';
import type { ConnectorType } from '$lib/canvas/connectors';

const marks = (...types: ConnectorType[]) => types.map((type) => ({ type, state: PortState.Quiet }));

const box = (contours: number[][]) => {
  const xs = contours.flatMap((c) => c.filter((_, i) => i % 2 === 0));
  const ys = contours.flatMap((c) => c.filter((_, i) => i % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v));
};

const glyphs: Glyphs = (text, size) => ({ contours: [[0, 0, text.length * size, 0, text.length * size, size, 0, size]], width: text.length * size, height: size });

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
  outputs: [],
  label: null,
  icon: null,
  names: false,
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
    const ports = ofPart(tile({ inputs: marks('text', 'images') }), ChromePart.PortIn);

    expect(ports.map((p) => box(p.contours))).toEqual([
      [90, 245, 100, 255],
      [90, 295, 100, 305]
    ]);
    expect(ports[1].paint).toEqual({ kind: PaintKind.Solid, color: rgbaOf(CONNECTOR_STYLE.images.color) });
  });

  it('centres the output port on the right edge', () => {
    const [port] = ofPart(tile({ outputs: marks('videos') }), ChromePart.PortOut);

    expect(box(port.contours)).toEqual([400, 270, 410, 280]);
  });

  it('puts four bordered corner handles on a selected resizable tile', () => {
    expect(ofPart(tile({ ring: NodeChrome.Selected, handles: true }), ChromePart.Handle)).toHaveLength(8);
    expect(ofPart(tile({ ring: NodeChrome.Selected }), ChromePart.Handle)).toHaveLength(0);
  });

  it('writes the label in a 1.3 line box padded 2px, 4px above the tile, left-aligned', () => {
    const [label] = ofPart(tile({ label: 'Image' }), ChromePart.Label);

    expect(box(label.contours)).toEqual([100, 178, 160, 190]);
  });

  it('draws chrome above the ring order: hover, ring, ports, handles, label', () => {
    const order = parts(tile({ ring: NodeChrome.Selected, handles: true, inputs: marks('text'), outputs: marks('text'), label: 'Text' })).map((i) => i.clip.split(':')[1]);

    expect([...new Set(order)]).toEqual([ChromePart.Ring, ChromePart.PortIn, ChromePart.PortOut, ChromePart.Handle, ChromePart.Label]);
  });

  it('names each port beside it, 16px outside, in its colour, only when asked', () => {
    const t = tile({ inputs: marks('text'), outputs: marks('images'), names: true });
    const names = ofPart(t, ChromePart.PortName);

    expect(names.map((n) => box(n.contours))).toEqual([
      [40, 270, 84, 281],
      [416, 270, 482, 281]
    ]);
    expect(ofPart(tile({ inputs: marks('text') }), ChromePart.PortName)).toHaveLength(0);
  });

  it('puts the kind icon before the label and shifts the label past it', () => {
    const t = tile({ label: 'Image', icon: [[0, 0, 12, 0, 12, 12, 0, 12]] });

    expect(box(ofPart(t, ChromePart.Icon)[0].contours)).toEqual([100, 180, 112, 192]);
    expect(box(ofPart(t, ChromePart.Label)[0].contours)).toEqual([117, 178, 177, 190]);
  });

  it('fills the icon strokes as a union, so overlapping round joins never cancel', () => {
    const [icon] = ofPart(tile({ label: 'Image', icon: [[0, 0, 12, 0, 12, 12, 0, 12]] }), ChromePart.Icon);

    expect(icon.rule).toBe(FillRule.Union);
  });

  it('sets the label untracked, as the canvas label is', () => {
    const asked: (number | undefined)[] = [];
    tileChrome(tile({ label: 'Image' }), (text, size, set) => (asked.push(set?.tracking), glyphs(text, size, set)));

    expect(asked).toEqual([0]);
  });
});
