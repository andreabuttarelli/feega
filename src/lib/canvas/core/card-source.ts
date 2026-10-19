import type { CardFace } from '$lib/canvas/gpu/card-face';
import { CONNECTOR_STYLE } from '$lib/canvas/connectors';
import type { PortTile } from '$lib/canvas/gpu/geometry';
import type { Box, FrameOnCanvas } from './canvas-scene';
import { cardItems, type CardIcons } from './cards';
import { PortState, tileChrome, type Glyphs, type PortMark } from './chrome';
import type { CoreTheme } from './overlay';

export type CardTile = {
  id: string;
  box: Box;
  face: CardFace;
  shot: string | null;
  inputs: readonly PortMark[];
  outputs: readonly PortMark[];
  label: string | null;
  icon: number[][] | null;
};

export const CHROME_REACH = { top: 24, side: 96, bottom: 4 };

export const ringColour = (t: Pick<CardTile, 'outputs'>, theme: Pick<CoreTheme, 'accent'>): string => (t.outputs.length ? CONNECTOR_STYLE[t.outputs[0].type].color : theme.accent);

export function cardOnCanvas(t: CardTile, theme: CoreTheme, glyphs: Glyphs, bold: Glyphs = glyphs, icons: CardIcons | null = null): FrameOnCanvas {
  const [x, y] = [CHROME_REACH.side, CHROME_REACH.top];
  const w = t.box.w + 2 * CHROME_REACH.side;
  const h = t.box.h + CHROME_REACH.top + CHROME_REACH.bottom;
  const card = cardItems({ id: t.id, x, y, w: t.box.w, h: t.box.h, face: t.face, shot: t.shot }, theme, glyphs, bold, icons);
  const chrome = tileChrome({ id: t.id, x, y, width: t.box.w, height: t.box.h, inputs: t.inputs, outputs: t.outputs, label: t.label, icon: t.icon }, glyphs);
  return {
    id: t.id,
    box: { x: t.box.x - x, y: t.box.y - y, w, h },
    list: { width: w, height: h, background: null, items: [...card, ...chrome], unsupported: [] }
  };
}

const NO_PORTS = { inputs: [], outputs: [] };

export function portMarks(t: PortTile): { inputs: PortMark[]; outputs: PortMark[] } {
  if (t.connectable === false) {
    return NO_PORTS;
  }
  const inputs = (t.connectors ?? []).map((type) => ({ type, state: PortState.Quiet }));
  const single = t.output ? [{ type: t.output, state: PortState.Quiet }] : [];
  const named = (t.outputs ?? []).map((o) => ({ type: o.port, state: PortState.Quiet, label: o.handle }));
  return { inputs, outputs: [...single, ...named] };
}

export function cardKey(t: CardTile): string {
  return `${t.id}:${JSON.stringify([t.box.w, t.box.h, t.face, t.shot, t.inputs, t.outputs, t.label])}`;
}
