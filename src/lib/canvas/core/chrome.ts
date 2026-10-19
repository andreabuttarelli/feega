import { NodeChrome } from '$lib/canvas/selection-chrome';
import { CONNECTOR_STYLE, type ConnectorType } from '$lib/canvas/connectors';
import type { PathItem } from '$lib/motion/gpu-full/display-list';
import { dashes } from '$lib/motion/gpu-full/stroke';
import { FillRule } from '$lib/motion/gpu-full/paint';
import { line, rect, solid } from './shapes';

export enum ChromePart {
  Hover = 'hover',
  Ring = 'ring',
  PortIn = 'port-in',
  PortOut = 'port-out',
  Handle = 'handle',
  Label = 'label',
  PortName = 'port-name',
  Icon = 'icon'
}

export type TextSet = { width?: number; height?: number; leading?: number; tracking?: number };

export type Glyphs = (text: string, size: number, set?: TextSet) => { contours: number[][]; width: number; height: number };

export type ChromeTile = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ring: NodeChrome;
  handles: boolean;
  hovered: boolean;
  ringColor: string;
  inputs: readonly ConnectorType[];
  output: ConnectorType | null;
  label: string | null;
  icon: number[][] | null;
  names: boolean;
};

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
const NAME_SIZE = 11;
const NAME_GAP = 16;

const item = (t: ChromeTile, part: ChromePart, contours: number[][], color: string, opacity = 1): PathItem => solid(`${t.id}:${part}`, contours, color, opacity);

function outline(t: ChromeTile, width: number): number[] {
  const inset = RING_OFFSET + width / 2;
  return rect(t.x - inset, t.y - inset, t.width + 2 * inset, t.height + 2 * inset);
}

const band = (t: ChromeTile, width: number) => line(outline(t, width), width, true);

function hover(t: ChromeTile): PathItem[] {
  if (!t.hovered || t.ring !== NodeChrome.None) {
    return [];
  }
  return [item(t, ChromePart.Hover, band(t, RING_WIDTH), HOVER_COLOR)];
}

const RINGS: Record<NodeChrome, (t: ChromeTile) => PathItem[]> = {
  [NodeChrome.None]: () => [],
  [NodeChrome.Selected]: (t) => [item(t, ChromePart.Ring, band(t, RING_WIDTH), t.ringColor)],
  [NodeChrome.Editing]: (t) =>
    dashes(outline(t, EDITING_WIDTH), true, DASH, DASH).map((d) => item(t, ChromePart.Ring, line(d, EDITING_WIDTH), t.ringColor, EDITING_OPACITY))
};

const spaced = (t: ChromeTile, i: number, n: number) => t.y + ((i + 1) / (n + 1)) * t.height;

const port = (t: ChromeTile, part: ChromePart, left: number, centre: number, type: ConnectorType) =>
  item(t, part, [rect(left, centre - PORT_SIZE / 2, PORT_SIZE, PORT_SIZE)], CONNECTOR_STYLE[type].color);

function ports(t: ChromeTile): PathItem[] {
  const inputs = t.inputs.map((type, i) => port(t, ChromePart.PortIn, t.x - PORT_SIZE, spaced(t, i, t.inputs.length), type));
  if (!t.output) {
    return inputs;
  }
  return [...inputs, port(t, ChromePart.PortOut, t.x + t.width, t.y + t.height / 2, t.output)];
}

function handles(t: ChromeTile): PathItem[] {
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

function label(t: ChromeTile, glyphs: Glyphs): PathItem[] {
  if (!t.label) {
    return [];
  }
  const line = LABEL_SIZE * LABEL_LEADING;
  const top = t.y - LABEL_GAP - LABEL_PAD - line;
  const icon = t.icon ? [{ ...item(t, ChromePart.Icon, shift(t.icon, t.x, top + (line - ICON_SIZE) / 2), LABEL_COLOR), rule: FillRule.Union }] : [];
  const left = t.icon ? t.x + ICON_SIZE + ICON_GAP : t.x;
  return [...icon, item(t, ChromePart.Label, shift(glyphs(t.label, LABEL_SIZE, { leading: LABEL_LEADING, tracking: 0 }).contours, left, top), LABEL_COLOR)];
}

function name(t: ChromeTile, glyphs: Glyphs, type: ConnectorType, centre: number, side: ChromePart): PathItem {
  const { contours, width } = glyphs(CONNECTOR_STYLE[type].label, NAME_SIZE, { leading: NAME_LEADING });
  const left = side === ChromePart.PortIn ? t.x - NAME_GAP - width : t.x + t.width + NAME_GAP;
  return item(t, ChromePart.PortName, shift(contours, left, centre - NAME_SIZE / 2), CONNECTOR_STYLE[type].color);
}

function names(t: ChromeTile, glyphs: Glyphs): PathItem[] {
  if (!t.names) {
    return [];
  }
  const inputs = t.inputs.map((type, i) => name(t, glyphs, type, spaced(t, i, t.inputs.length), ChromePart.PortIn));
  return t.output ? [...inputs, name(t, glyphs, t.output, t.y + t.height / 2, ChromePart.PortOut)] : inputs;
}

export const tileChrome = (t: ChromeTile, glyphs: Glyphs): PathItem[] => [...hover(t), ...RINGS[t.ring](t), ...ports(t), ...names(t, glyphs), ...handles(t), ...label(t, glyphs)];
