import { NodeChrome } from '$lib/canvas/selection-chrome';
import { CONNECTOR_STYLE, type ConnectorType } from '$lib/canvas/connectors';
import type { PathItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { dashes } from '@feega/motion-core/motion/gpu-full/stroke';
import { FillRule } from '@feega/motion-core/motion/gpu-full/paint';
import { circle, line, rect, reverse, roundRect, solid } from './shapes';

export enum ChromePart {
  Hover = 'hover',
  Ring = 'ring',
  PortIn = 'port-in',
  PortOut = 'port-out',
  Handle = 'handle',
  Label = 'label',
  PortName = 'port-name',
  PortRing = 'port-ring',
  Icon = 'icon',
  Tag = 'tag'
}

export type TextSet = { width?: number; height?: number; leading?: number; tracking?: number };

export enum PortState {
  Quiet = 'quiet',
  Lit = 'lit',
  Off = 'off',
  Flagged = 'flagged'
}

export type PortMark = { type: ConnectorType; state: PortState; label?: string };

export type Glyphs = (text: string, size: number, set?: TextSet) => { contours: number[][]; width: number; height: number };

export type ChromeTile = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inputs: readonly PortMark[];
  outputs: readonly PortMark[];
  label: string | null;
  icon: number[][] | null;
  tag?: string | null;
  addBeside?: boolean;
  radius?: number;
};

export type ChromeState = { ring: NodeChrome; handles: boolean; hovered: boolean; ringColor: string; names: boolean };

export type StateTile = ChromeTile & ChromeState;

const RING_WIDTH = 2;
const RING_OFFSET = 1;
const EDITING_WIDTH = 1;
const EDITING_OPACITY = 0.5;
const DASH = 4;
const PORT_SIZE = 10;
const HANDLE_SIZE = 8;
const HANDLE_BORDER = 1;
const LABEL_SIZE = 12;
const LABEL_GAP = 4;
const LABEL_PAD = 2;
const LABEL_LEADING = 1.3;
const NAME_LEADING = 1;
const HOVER_COLOR = '#b14cff';
const HANDLE_FILL = '#ffffff';
const LABEL_COLOR = '#6e6e73';
const ICON_SIZE = 12;
const ICON_GAP = 5;
const ELLIPSIS = '…';
const NAME_SIZE = 11;
const NAME_GAP = 16;
export const ADD_BESIDE = { offset: 8, size: 24, gap: 8 };
const PORT_RING = 1;
const TAG_RADIUS = 4;

const PORT_LOOK: Record<PortState, { opacity: number; ring: boolean; named: boolean }> = {
  [PortState.Quiet]: { opacity: 1, ring: false, named: false },
  [PortState.Lit]: { opacity: 1, ring: true, named: true },
  [PortState.Off]: { opacity: 0.12, ring: false, named: false },
  [PortState.Flagged]: { opacity: 0.5, ring: false, named: false }
};

const item = (t: ChromeTile, part: ChromePart, contours: number[][], color: string, opacity = 1): PathItem => solid(`${t.id}:${part}`, contours, color, opacity);

function outline(t: ChromeTile, width: number): number[] {
  const inset = RING_OFFSET + width / 2;
  return rect(t.x - inset, t.y - inset, t.width + 2 * inset, t.height + 2 * inset);
}

function roundBand(t: ChromeTile, width: number, radius: number): number[][] {
  const inner = RING_OFFSET;
  const outer = RING_OFFSET + width;
  return [
    ...roundRect(t.x - outer, t.y - outer, t.width + 2 * outer, t.height + 2 * outer, radius + outer),
    ...roundRect(t.x - inner, t.y - inner, t.width + 2 * inner, t.height + 2 * inner, radius + inner).map(reverse)
  ];
}

const band = (t: ChromeTile, width: number) => (t.radius ? roundBand(t, width, t.radius) : line(outline(t, width), width, true));

function hover(t: StateTile): PathItem[] {
  if (!t.hovered || t.ring !== NodeChrome.None) {
    return [];
  }
  return [item(t, ChromePart.Hover, band(t, RING_WIDTH), HOVER_COLOR)];
}

const RINGS: Record<NodeChrome, (t: StateTile) => PathItem[]> = {
  [NodeChrome.None]: () => [],
  [NodeChrome.Selected]: (t) => [item(t, ChromePart.Ring, band(t, RING_WIDTH), t.ringColor)],
  [NodeChrome.Editing]: (t) => [item(t, ChromePart.Ring, dashes(outline(t, EDITING_WIDTH), true, [DASH, DASH]).flatMap((d) => line(d, EDITING_WIDTH)), t.ringColor, EDITING_OPACITY)]
};

const spaced = (t: ChromeTile, i: number, n: number) => t.y + ((i + 1) / (n + 1)) * t.height;

function port(t: ChromeTile, part: ChromePart, left: number, centre: number, m: PortMark): PathItem[] {
  const top = centre - PORT_SIZE / 2;
  const colour = CONNECTOR_STYLE[m.type].color;
  const look = PORT_LOOK[m.state];
  const inset = PORT_RING + PORT_RING / 2;
  const ring = look.ring ? [item(t, ChromePart.PortRing, line(rect(left - inset, top - inset, PORT_SIZE + 2 * inset, PORT_SIZE + 2 * inset), PORT_RING, true), colour)] : [];
  return [item(t, part, [rect(left, top, PORT_SIZE, PORT_SIZE)], colour, look.opacity), ...ring];
}

function ports(t: ChromeTile): PathItem[] {
  const inputs = t.inputs.flatMap((m, i) => port(t, ChromePart.PortIn, t.x - PORT_SIZE, spaced(t, i, t.inputs.length), m));
  const outputs = t.outputs.flatMap((m, i) => port(t, ChromePart.PortOut, t.x + t.width, spaced(t, i, t.outputs.length), m));
  return [...inputs, ...outputs];
}

function handles(t: StateTile): PathItem[] {
  if (!t.handles || t.ring !== NodeChrome.Selected) {
    return [];
  }
  const half = HANDLE_SIZE / 2;
  const corners = [
    [t.x, t.y],
    [t.x + t.width, t.y],
    [t.x, t.y + t.height],
    [t.x + t.width, t.y + t.height]
  ];
  return corners.flatMap(([cx, cy]) => [
    item(t, ChromePart.Handle, [rect(cx - half, cy - half, HANDLE_SIZE, HANDLE_SIZE)], t.ringColor),
    item(t, ChromePart.Handle, [rect(cx - half + HANDLE_BORDER, cy - half + HANDLE_BORDER, HANDLE_SIZE - 2 * HANDLE_BORDER, HANDLE_SIZE - 2 * HANDLE_BORDER)], HANDLE_FILL)
  ]);
}

const shift = (contours: number[][], dx: number, dy: number) => contours.map((c) => c.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)));

const LABEL_SET: TextSet = { leading: LABEL_LEADING, tracking: 0 };

function fitted(text: string, room: number, glyphs: Glyphs) {
  const whole = glyphs(text, LABEL_SIZE, LABEL_SET);
  if (whole.width <= room) {
    return whole;
  }
  let kept = text.length;
  let cut = whole;
  while (kept > 0 && cut.width > room) {
    kept -= 1;
    cut = glyphs(text.slice(0, kept).trimEnd() + ELLIPSIS, LABEL_SIZE, LABEL_SET);
  }
  return cut;
}

function tag(t: ChromeTile): PathItem[] {
  if (!t.tag) {
    return [];
  }
  const row = LABEL_SIZE * LABEL_LEADING;
  const centre = t.y - LABEL_GAP - LABEL_PAD - row / 2;
  return [item(t, ChromePart.Tag, circle(t.x + t.width - TAG_RADIUS, centre, TAG_RADIUS), t.tag)];
}

function label(t: ChromeTile, glyphs: Glyphs): PathItem[] {
  if (!t.label) {
    return [];
  }
  const line = LABEL_SIZE * LABEL_LEADING;
  const top = t.y - LABEL_GAP - LABEL_PAD - line;
  const icon = t.icon ? [{ ...item(t, ChromePart.Icon, shift(t.icon, t.x, top + (line - ICON_SIZE) / 2), LABEL_COLOR), rule: FillRule.Union }] : [];
  const left = t.icon ? t.x + ICON_SIZE + ICON_GAP : t.x;
  const text = fitted(t.label, t.x + t.width - left, glyphs);
  return [...icon, item(t, ChromePart.Label, shift(text.contours, left, top), LABEL_COLOR)];
}

function name(t: ChromeTile, glyphs: Glyphs, m: PortMark, centre: number, side: ChromePart): PathItem {
  const type = m.type;
  const { contours, width } = glyphs(m.label ?? CONNECTOR_STYLE[type].label, NAME_SIZE, { leading: NAME_LEADING });
  const outGap = t.addBeside ? ADD_BESIDE.offset + ADD_BESIDE.size + ADD_BESIDE.gap : NAME_GAP;
  const left = side === ChromePart.PortIn ? t.x - NAME_GAP - width : t.x + t.width + outGap;
  return item(t, ChromePart.PortName, shift(contours, left, centre - NAME_SIZE / 2), CONNECTOR_STYLE[type].color);
}

function names(t: ChromeTile, glyphs: Glyphs, shown: (m: PortMark) => boolean): PathItem[] {
  const inputs = t.inputs.flatMap((m, i) => (shown(m) ? [name(t, glyphs, m, spaced(t, i, t.inputs.length), ChromePart.PortIn)] : []));
  const outputs = t.outputs.flatMap((m, i) => (shown(m) ? [name(t, glyphs, m, spaced(t, i, t.outputs.length), ChromePart.PortOut)] : []));
  return [...inputs, ...outputs];
}

const lit = (m: PortMark) => PORT_LOOK[m.state].named;

export const tileChrome = (t: ChromeTile, glyphs: Glyphs): PathItem[] => [...ports(t), ...names(t, glyphs, lit), ...label(t, glyphs), ...tag(t)];

export const stateChrome = (t: StateTile, glyphs: Glyphs): PathItem[] => [...hover(t), ...RINGS[t.ring](t), ...(t.names ? names(t, glyphs, (m) => !lit(m)) : []), ...handles(t)];
