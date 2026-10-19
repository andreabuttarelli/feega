import type { CardFace } from '$lib/canvas/gpu/card-face';
import { CONNECTOR_STYLE } from '$lib/canvas/connectors';
import type { PortTile } from '$lib/canvas/gpu/geometry';
import type { NodeChrome } from '$lib/canvas/selection-chrome';
import type { Box, FrameOnCanvas } from './canvas-scene';
import { cardItems } from './cards';
import { PortState, tileChrome, type Glyphs, type PortMark } from './chrome';
import type { CoreTheme } from './overlay';

export type CardTile = {
  id: string;
  box: Box;
  face: CardFace;
  ring: NodeChrome;
  handles: boolean;
  hovered: boolean;
  inputs: readonly PortMark[];
  outputs: readonly PortMark[];
  label: string | null;
  icon: number[][] | null;
};

export const CHROME_REACH = { top: 24, side: 96, bottom: 4 };

export function cardOnCanvas(t: CardTile, theme: CoreTheme, glyphs: Glyphs, bold: Glyphs = glyphs): FrameOnCanvas {
  const [x, y] = [CHROME_REACH.side, CHROME_REACH.top];
  const w = t.box.w + 2 * CHROME_REACH.side;
  const h = t.box.h + CHROME_REACH.top + CHROME_REACH.bottom;
  const card = cardItems({ id: t.id, x, y, w: t.box.w, h: t.box.h, face: t.face }, theme, glyphs, bold);
  const chrome = tileChrome({ id: t.id, x, y, width: t.box.w, height: t.box.h, ring: t.ring, handles: t.handles, hovered: t.hovered, ringColor: t.outputs.length ? CONNECTOR_STYLE[t.outputs[0].type].color : theme.accent, inputs: t.inputs, outputs: t.outputs, label: t.label, icon: t.icon, names: false }, glyphs);
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
  return `${t.id}:${JSON.stringify([t.box.w, t.box.h, t.face, t.ring, t.handles, t.hovered, t.inputs, t.outputs, t.label])}`;
}
