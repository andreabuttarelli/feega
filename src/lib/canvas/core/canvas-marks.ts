import { rgbaOf } from '@feega/motion-core/motion/gpu-full/rgba';
import { SelectionKind } from '$lib/canvas/frame-transform';
import { HIGHLIGHT, HighlightKind } from '$lib/canvas/highlight';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import { CORNER_HIT_PX, ROTATE_REACH_PX } from '$lib/canvas/gpu/geometry';
import {
  FAR_BOOST,
  FAR_BOOST_FULL_ZOOM,
  FAR_ZOOM,
  HANDLE_SCREEN_PX,
  HOVER_SCREEN_PX,
  SELECT_SCREEN_PX,
} from './label-size';

export enum MarkPart {
  Body = 0,
  Handle = 1,
  Edge = 2,
  Rotate = 3,
}

export enum MarkLine {
  Solid = 'solid',
  Dashed = 'dashed',
  None = 'none',
}

export enum MarkHandles {
  None = 'none',
  Corners = 'corners',
  All = 'all',
}

export type CanvasMark = {
  id: string;
  quad: number[];
  line: MarkLine;
  color: string;
  opacity: number;
  width: number;
  offset: number;
  radius: number;
  handles: MarkHandles;
  onRing: boolean;
  boosted: boolean;
  hitReach: number;
  body: boolean;
  edges: boolean;
  rotate: boolean;
};

export type MarkLook = {
  handleFill: string;
  handleRadius: number;
  dpr: number;
};

export type MarkHit = { id: string; part: MarkPart; n: number };

export type MarkBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  radius?: number;
};

export type NodeMarkBox = MarkBox & {
  ring: NodeChrome;
  handles: boolean;
  ringColor: string;
};

type ScreenPt = readonly [number, number];

const RING_OFFSET_PX = 1;
const HOVER_GAP_PX = 1;
const SELECTION_PX = 1;
const EDITING_PX = 1;
const EDITING_OPACITY = 0.5;
const HANDLE_BORDER_PX = 1;
const EDGE_PX = 8;
const DASH_PX = 4;
const DEGREES = Math.PI / 180;
const HANDLE_ROUNDING: Record<MarkHandles, number> = {
  [MarkHandles.None]: 0,
  [MarkHandles.Corners]: 0,
  [MarkHandles.All]: 1,
};
const BLACK: [number, number, number, number] = [0, 0, 0, 1];

const PASSES_THROUGH: ReadonlySet<SelectionKind> = new Set([
  SelectionKind.Group,
  SelectionKind.Many,
]);
const BOXLESS: ReadonlySet<SelectionKind> = new Set([
  SelectionKind.Member,
  SelectionKind.Line,
]);
const SELECTION_LINE: Record<SelectionKind, MarkLine> = {
  [SelectionKind.Element]: MarkLine.Solid,
  [SelectionKind.Member]: MarkLine.Solid,
  [SelectionKind.Many]: MarkLine.Solid,
  [SelectionKind.Group]: MarkLine.Dashed,
  [SelectionKind.Line]: MarkLine.None,
};

const QUIET: Omit<
  CanvasMark,
  'id' | 'quad' | 'line' | 'color' | 'width' | 'offset'
> = {
  opacity: 1,
  radius: 0,
  handles: MarkHandles.None,
  onRing: false,
  boosted: false,
  hitReach: 0,
  body: false,
  edges: false,
  rotate: false,
};

export function boxCorners(b: Omit<MarkBox, 'id'>): [number, number][] {
  const corners: [number, number][] = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x + b.w, b.y + b.h],
    [b.x, b.y + b.h],
  ];
  if (!b.rotation) {
    return corners;
  }
  const [cx, cy] = [b.x + b.w / 2, b.y + b.h / 2];
  const [cos, sin] = [
    Math.cos(b.rotation * DEGREES),
    Math.sin(b.rotation * DEGREES),
  ];
  return corners.map(([x, y]) => [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (x - cx) * sin + (y - cy) * cos,
  ]);
}

const boxQuad = (b: MarkBox): number[] => boxCorners(b).flat();

export const hoverMark = (b: MarkBox): CanvasMark => ({
  ...QUIET,
  id: b.id,
  quad: boxQuad(b),
  line: MarkLine.Solid,
  color: HIGHLIGHT[HighlightKind.Node],
  width: HOVER_SCREEN_PX,
  offset: HOVER_GAP_PX,
  radius: b.radius ?? 0,
  boosted: true,
});

const NODE_RING: Record<
  Exclude<NodeChrome, NodeChrome.None>,
  (b: NodeMarkBox) => Partial<CanvasMark>
> = {
  [NodeChrome.Selected]: (b) => ({
    line: MarkLine.Solid,
    width: SELECT_SCREEN_PX,
    boosted: true,
    handles: b.handles ? MarkHandles.Corners : MarkHandles.None,
    onRing: true,
    edges: b.handles,
    hitReach: CORNER_HIT_PX,
  }),
  [NodeChrome.Editing]: () => ({
    line: MarkLine.Dashed,
    width: EDITING_PX,
    opacity: EDITING_OPACITY,
  }),
};

export const nodeMark = (
  b: NodeMarkBox & { ring: Exclude<NodeChrome, NodeChrome.None> },
): CanvasMark => ({
  ...QUIET,
  id: b.id,
  quad: boxQuad(b),
  line: MarkLine.Solid,
  color: b.ringColor,
  width: SELECT_SCREEN_PX,
  offset: RING_OFFSET_PX,
  radius: b.radius ?? 0,
  ...NODE_RING[b.ring](b),
});

export function selectionMark(
  id: string,
  quad: readonly ScreenPt[],
  kind: SelectionKind,
  highlight: HighlightKind,
): CanvasMark {
  const handled = !BOXLESS.has(kind);
  return {
    ...QUIET,
    id,
    quad: quad.flat(),
    line: SELECTION_LINE[kind],
    color: HIGHLIGHT[highlight],
    width: SELECTION_PX,
    offset: -SELECTION_PX,
    handles: handled ? MarkHandles.All : MarkHandles.None,
    body: !PASSES_THROUGH.has(kind),
    edges: handled,
    rotate: handled,
  };
}

function colourOf(css: string, opacity: number): number[] {
  const [r, g, b, a] = rgbaOf(css) ?? BLACK;
  return [r, g, b, a * opacity];
}

export function marksJson(
  marks: readonly CanvasMark[],
  look: MarkLook,
): string {
  const px = (v: number) => v * look.dpr;
  return JSON.stringify({
    marks: marks.map((m) => ({
      quad: m.quad,
      line: m.line,
      color: colourOf(m.color, m.opacity),
      width: px(m.width),
      offset: px(m.offset),
      radius: m.radius,
      handles: m.handles,
      handleRadius: px(look.handleRadius * HANDLE_ROUNDING[m.handles]),
      onRing: m.onRing,
      boosted: m.boosted,
      hitReach: px(m.hitReach),
      body: m.body,
      edges: m.edges,
      rotate: m.rotate,
    })),
    look: {
      handle: px(HANDLE_SCREEN_PX),
      border: px(HANDLE_BORDER_PX),
      fill: colourOf(look.handleFill, 1),
      far: [FAR_ZOOM, FAR_BOOST, FAR_BOOST_FULL_ZOOM],
      dpr: look.dpr,
      edge: px(EDGE_PX),
      reach: px(ROTATE_REACH_PX),
      dash: px(DASH_PX),
    },
  });
}

export function markHit(
  marks: readonly CanvasMark[],
  raw: Float64Array,
): MarkHit | null {
  const mark = raw.length ? marks[raw[0]] : undefined;
  return mark ? { id: mark.id, part: raw[1] as MarkPart, n: raw[2] } : null;
}

export function markRect(
  raw: Float64Array,
  dpr: number,
): { x: number; y: number; w: number; h: number } | null {
  if (!raw.length) {
    return null;
  }
  const [x, y, w, h] = [...raw].map((v) => v / dpr);
  return { x, y, w, h };
}
