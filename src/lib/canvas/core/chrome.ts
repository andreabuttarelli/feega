import { NodeChrome } from '$lib/canvas/selection-chrome';
import { CONNECTOR_STYLE, type ConnectorType } from '$lib/canvas/connectors';
import type { PathItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { dashes } from '@feega/motion-core/motion/gpu-full/stroke';
import { FillRule } from '@feega/motion-core/motion/gpu-full/paint';
import { HANDLE_SCREEN_PX, HOVER_SCREEN_PX, SELECT_SCREEN_PX, labelScale, labelShown, strokeWorld } from './label-size';
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
  zoom?: number;
  strokeZoom?: number;
};

export type ChromeState = { ring: NodeChrome; handles: boolean; hovered: boolean; ringColor: string; names: boolean };

export type StateTile = ChromeTile & ChromeState;

const RING_OFFSET = 1;
const EDITING_SCREEN_PX = 1;
const EDITING_OPACITY = 0.5;
const DASH = 4;
const PORT_SIZE = 10;
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

const unit = (t: ChromeTile, screenPx: number): number => screenPx / (t.strokeZoom ?? 1);

const widthOf = (t: ChromeTile, screenPx: number): number => strokeWorld(screenPx, t.strokeZoom ?? 1);

function outline(t: ChromeTile, width: number): number[] {
  const inset = unit(t, RING_OFFSET) + width / 2;
  return rect(t.x - inset, t.y - inset, t.width + 2 * inset, t.height + 2 * inset);
}

function roundBand(t: ChromeTile, width: number, radius: number): number[][] {
  const inner = unit(t, RING_OFFSET);
  const outer = inner + width;
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
  return [item(t, ChromePart.Hover, band(t, widthOf(t, HOVER_SCREEN_PX)), HOVER_COLOR)];
}

const RINGS: Record<NodeChrome, (t: StateTile) => PathItem[]> = {
  [NodeChrome.None]: () => [],
  [NodeChrome.Selected]: (t) => [item(t, ChromePart.Ring, band(t, widthOf(t, SELECT_SCREEN_PX)), t.ringColor)],
  [NodeChrome.Editing]: (t) => [item(t, ChromePart.Ring, dashes(outline(t, unit(t, EDITING_SCREEN_PX)), true, [unit(t, DASH), unit(t, DASH)]).flatMap((d) => line(d, unit(t, EDITING_SCREEN_PX))), t.ringColor, EDITING_OPACITY)]
};

const spaced = (t: ChromeTile, i: number, n: number) => t.y + ((i + 1) / (n + 1)) * t.height;

function port(t: ChromeTile, part: ChromePart, left: number, centre: number, m: PortMark): PathItem[] {
  const colour = CONNECTOR_STYLE[m.type].color;
  const look = PORT_LOOK[m.state];
  const inset = PORT_RING + PORT_RING / 2;
  const cx = left + PORT_SIZE / 2;
  const outer = PORT_SIZE / 2 + inset + PORT_RING / 2;
  const ring = look.ring ? [item(t, ChromePart.PortRing, [...circle(cx, centre, outer), ...circle(cx, centre, outer - PORT_RING).map(reverse)], colour)] : [];
  return [item(t, part, circle(cx, centre, PORT_SIZE / 2), colour, look.opacity), ...ring];
}

export function ports(t: ChromeTile): PathItem[] {
  const inputs = t.inputs.flatMap((m, i) => port(t, ChromePart.PortIn, t.x - PORT_SIZE, spaced(t, i, t.inputs.length), m));
  const outputs = t.outputs.flatMap((m, i) => port(t, ChromePart.PortOut, t.x + t.width, spaced(t, i, t.outputs.length), m));
  return [...inputs, ...outputs];
}

function handles(t: StateTile): PathItem[] {
  if (!t.handles || t.ring !== NodeChrome.Selected) {
    return [];
  }
  const size = unit(t, HANDLE_SCREEN_PX);
  const border = unit(t, HANDLE_BORDER);
  const half = size / 2;
  const out = unit(t, RING_OFFSET) + widthOf(t, SELECT_SCREEN_PX) / 2;
  const corners = [
    [t.x - out, t.y - out],
    [t.x + t.width + out, t.y - out],
    [t.x - out, t.y + t.height + out],
    [t.x + t.width + out, t.y + t.height + out]
  ];
  return corners.flatMap(([cx, cy]) => [
    item(t, ChromePart.Handle, [rect(cx - half, cy - half, size, size)], t.ringColor),
    item(t, ChromePart.Handle, [rect(cx - half + border, cy - half + border, size - 2 * border, size - 2 * border)], HANDLE_FILL)
  ]);
}

const shift = (contours: number[][], dx: number, dy: number) => contours.map((c) => c.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)));

const scaled = (contours: number[][], k: number) => contours.map((c) => c.map((v) => v * k));

const LABEL_SET: TextSet = { leading: LABEL_LEADING, tracking: 0 };

function fitted(text: string, room: number, glyphs: Glyphs, size: number) {
  const whole = glyphs(text, size, LABEL_SET);
  if (whole.width <= room) {
    return whole;
  }
  let kept = text.length;
  let cut = whole;
  while (kept > 0 && cut.width > room) {
    kept -= 1;
    cut = glyphs(text.slice(0, kept).trimEnd() + ELLIPSIS, size, LABEL_SET);
  }
  return cut;
}

const labelK = (t: ChromeTile) => labelScale(t.zoom ?? 1);

const labelHidden = (t: ChromeTile) => !labelShown(t.zoom ?? 1, t.width);

function tag(t: ChromeTile): PathItem[] {
  if (!t.tag || labelHidden(t)) {
    return [];
  }
  const k = labelK(t);
  const row = LABEL_SIZE * LABEL_LEADING * k;
  const centre = t.y - (LABEL_GAP + LABEL_PAD) * k - row / 2;
  return [item(t, ChromePart.Tag, circle(t.x + t.width - TAG_RADIUS * k, centre, TAG_RADIUS * k), t.tag)];
}

function label(t: ChromeTile, glyphs: Glyphs): PathItem[] {
  if (!t.label || labelHidden(t)) {
    return [];
  }
  const k = labelK(t);
  const line = LABEL_SIZE * LABEL_LEADING * k;
  const top = t.y - (LABEL_GAP + LABEL_PAD) * k - line;
  const iconSize = ICON_SIZE * k;
  const icon = t.icon ? [{ ...item(t, ChromePart.Icon, shift(scaled(t.icon, k), t.x, top + (line - iconSize) / 2), LABEL_COLOR), rule: FillRule.Union }] : [];
  const left = t.icon ? t.x + (ICON_SIZE + ICON_GAP) * k : t.x;
  const text = fitted(t.label, t.x + t.width - left, glyphs, LABEL_SIZE * k);
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
