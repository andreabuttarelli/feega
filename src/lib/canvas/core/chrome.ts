import { NodeChrome } from '$lib/canvas/selection-chrome';
import { CONNECTOR_STYLE, type ConnectorType } from '$lib/canvas/connectors';
import { rgbaOf, type Rgba } from '$lib/motion/gpu-full/rgba';
import { FillRule, PaintKind } from '$lib/motion/gpu-full/paint';
import { ItemKind, type PathItem } from '$lib/motion/gpu-full/display-list';
import { BlendMode } from '$lib/motion/blend';
import { IDENTITY } from '$lib/motion/parent';
import { Cap, Join, dashes, strokePolygons } from '$lib/motion/gpu-full/stroke';

export enum ChromePart {
  Hover = 'hover',
  Ring = 'ring',
  PortIn = 'port-in',
  PortOut = 'port-out',
  Handle = 'handle',
  Label = 'label'
}

export type Glyphs = (text: string, size: number) => { contours: number[][]; width: number };

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
const HOVER_COLOR = '#b14cff';
const HANDLE_FILL = '#ffffff';
const LABEL_COLOR = '#6e6e73';

const rect = (x: number, y: number, w: number, h: number): number[] => [x, y, x + w, y, x + w, y + h, x, y + h];

const solid = (css: string): Rgba => rgbaOf(css) ?? [0, 0, 0, 1];

function item(t: ChromeTile, part: ChromePart, contours: number[][], color: string, opacity = 1): PathItem {
  return { kind: ItemKind.Path, clip: `${t.id}:${part}`, contours, rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: solid(color) }, opacity, matrix: IDENTITY, blur: 0, blend: BlendMode.Normal };
}

function outline(t: ChromeTile, width: number): number[] {
  const inset = RING_OFFSET + width / 2;
  return rect(t.x - inset, t.y - inset, t.width + 2 * inset, t.height + 2 * inset);
}

const band = (t: ChromeTile, width: number) => strokePolygons(outline(t, width), true, width, Cap.Butt, Join.Miter);

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
    dashes(outline(t, EDITING_WIDTH), true, DASH, DASH).map((d) => item(t, ChromePart.Ring, strokePolygons(d, false, EDITING_WIDTH, Cap.Butt, Join.Miter), t.ringColor, EDITING_OPACITY))
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

function label(t: ChromeTile, glyphs: Glyphs): PathItem[] {
  if (!t.label) {
    return [];
  }
  const baseline = t.y - LABEL_GAP;
  const { contours } = glyphs(t.label, LABEL_SIZE);
  const placed = contours.map((c) => c.map((v, i) => (i % 2 === 0 ? v + t.x : v + baseline)));
  return [item(t, ChromePart.Label, placed, LABEL_COLOR)];
}

export const tileChrome = (t: ChromeTile, glyphs: Glyphs): PathItem[] => [...hover(t), ...RINGS[t.ring](t), ...ports(t), ...handles(t), ...label(t, glyphs)];
