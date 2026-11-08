import type { Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { HIGHLIGHT, HighlightKind } from '../highlight';
import type { CardFace } from '$lib/canvas/gpu/card-face';
import type { PortTile } from '$lib/canvas/gpu/geometry';
import type { Box, FrameOnCanvas } from './canvas-scene';
import { cardItems } from './cards';
import type { CardIcons } from './card-kit';
import { PortState, labelChrome, portChrome, tileChrome, type ChromeTile, type Glyphs, type PortMark } from './chrome';
import { labelScale } from './label-size';
import { shiftDown } from './shift-down';
import type { CoreTheme } from './overlay';

export type CardTile = {
  id: string;
  box: Box;
  face: CardFace;
  inputs: readonly PortMark[];
  outputs: readonly PortMark[];
  label: string | null;
  icon: number[][] | null;
  tag?: string | null;
  zoom?: number;
};

export const CHROME_REACH = { top: 24, side: 96, bottom: 4 };

const reachTop = (t: Pick<CardTile, 'zoom'>): number => CHROME_REACH.top * 2 ** Math.ceil(Math.log2(Math.max(1, labelScale(t.zoom ?? 1))));

export const ringColour = (): string => HIGHLIGHT[HighlightKind.Node];

export enum CardLayer {
  Whole = 'whole',
  Face = 'face'
}

export function cardOnCanvas(t: CardTile, theme: CoreTheme, glyphs: Glyphs, bold: Glyphs = glyphs, icons: CardIcons | null = null, layer = CardLayer.Whole): FrameOnCanvas {
  const card = cardItems({ id: t.id, x: CHROME_REACH.side, y: reachTop(t), w: t.box.w, h: t.box.h, face: t.face }, theme, glyphs, bold, icons);
  return framed(t, card, glyphs, layer);
}

const chromeTile = (t: CardTile, x: number, y: number): ChromeTile => ({ id: t.id, x, y, width: t.box.w, height: t.box.h, inputs: t.inputs, outputs: t.outputs, label: t.label, icon: t.icon, tag: t.tag, zoom: t.zoom });

function framed(t: CardTile, card: Item[], glyphs: Glyphs, layer: CardLayer): FrameOnCanvas {
  const chrome = layer === CardLayer.Face ? [] : tileChrome(chromeTile(t, CHROME_REACH.side, reachTop(t)), glyphs);
  return listed(t, [...card, ...chrome]);
}

function listed(t: CardTile, items: Item[]): FrameOnCanvas {
  const y = reachTop(t);
  const w = t.box.w + 2 * CHROME_REACH.side;
  const h = t.box.h + y + CHROME_REACH.bottom;
  return {
    id: t.id,
    box: { x: t.box.x - CHROME_REACH.side, y: t.box.y - y, w, h },
    list: { width: w, height: h, background: null, items, unsupported: [] }
  };
}

type Body = { items: Item[]; reached: Map<string, Item[]> };

const BODIES_PER_CARD = 2;

export function cardsOnCanvas(theme: CoreTheme, glyphs: Glyphs, bold: Glyphs = glyphs, icons: CardIcons | null = null): (t: CardTile, layer?: CardLayer) => FrameOnCanvas {
  const drawn = new Map<string, { key: string; frame: FrameOnCanvas }>();
  const bodies = new Map<string, Map<string, Body>>();
  const bodyOf = (t: CardTile): Body => {
    const key = bodyKey(t);
    const kept = bodies.get(t.id) ?? new Map<string, Body>();
    const body = kept.get(key) ?? { items: cardItems({ id: t.id, x: CHROME_REACH.side, y: 0, w: t.box.w, h: t.box.h, face: t.face }, theme, glyphs, bold, icons), reached: new Map() };
    kept.delete(key);
    kept.set(key, body);
    if (kept.size > BODIES_PER_CARD) {
      kept.delete(kept.keys().next().value!);
    }
    bodies.set(t.id, kept);
    return body;
  };
  const steady = (t: CardTile, layer: CardLayer): Item[] => {
    const body = bodyOf(t);
    const top = reachTop(t);
    const key = `${layer}:${top}:${JSON.stringify([t.inputs, t.outputs])}`;
    const hit = body.reached.get(key);
    if (hit) {
      return hit;
    }
    const ports = layer === CardLayer.Face ? [] : portChrome(chromeTile(t, CHROME_REACH.side, top), glyphs);
    const items = [...shiftDown(body.items, top), ...ports];
    body.reached.set(key, items);
    return items;
  };
  const draw = (t: CardTile, layer: CardLayer): FrameOnCanvas => {
    const label = layer === CardLayer.Face ? [] : labelChrome(chromeTile(t, CHROME_REACH.side, reachTop(t)), glyphs);
    return listed(t, [...steady(t, layer), ...label]);
  };
  return (t, layer = CardLayer.Whole) => {
    const key = `${layer}:${cardKey(t)}`;
    const hit = drawn.get(t.id);
    const frame = hit?.key === key ? hit.frame : draw(t, layer);
    drawn.set(t.id, { key, frame });
    return { ...frame, box: { ...frame.box, x: t.box.x - CHROME_REACH.side, y: t.box.y - reachTop(t) } };
  };
}

const NO_PORTS ={ inputs: [], outputs: [] };

export function portMarks(t: PortTile): { inputs: PortMark[]; outputs: PortMark[] } {
  if (t.connectable === false) {
    return NO_PORTS;
  }
  const inputs = (t.connectors ?? []).map((type) => ({ type, state: PortState.Quiet }));
  const single = t.output ? [{ type: t.output, state: PortState.Quiet }] : [];
  const named = (t.outputs ?? []).map((o) => ({ type: o.port, state: PortState.Quiet, label: o.handle }));
  return { inputs, outputs: [...single, ...named] };
}

const bodyKey = (t: CardTile): string => JSON.stringify([t.box.w, t.box.h, t.face]);

export function cardKey(t: CardTile): string {
  return `${t.id}:${JSON.stringify([t.box.w, t.box.h, t.face, t.inputs, t.outputs, t.label, t.tag, t.zoom])}`;
}
