import { withSurface } from '@feega/motion-core/motion/surface';
import { DEFAULT_COLOUR } from '@feega/motion-core/motion/default-colours';
import { COMPONENTS, TYPE_SIZE, type ComponentId } from '@feega/motion-core/motion/components';
import { NEW_TEXT_SIZING, TextSizing } from '@feega/motion-core/motion/text-sizing';
import { Background, MAX_SHORT_SIDE, MAX_SIDE, MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { DrawTool, type DragPoint, type DrawBox } from './draw-tool';
import { corner, mapOutline, parsePath, pathData, type Outline, type Pt } from '@feega/motion-core/motion/shape/geometry';
import { FillKind, ShapeKind, StrokeKind } from '@feega/motion-core/motion/shape/schema';
import type { SvgFillRule, SvgGradient } from './shape/svg-import';
import { FillType } from '@feega/motion-core/motion/fill/model';
import { setClipFlags } from '@feega/motion-core/motion/organize';
import { Direction, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { setAutoLayout, setLayoutItem } from './layout/ops';
import { EditMode } from './edit-mode';
import { DocMode, docMode, setStill, settledStill } from '@feega/motion-core/motion/still';
import { TOP_LEFT_START, addClip, type OpResult } from '@feega/motion-core/motion/timeline';

type BoxTool = DrawTool.Text | DrawTool.Rectangle | DrawTool.Ellipse | DrawTool.Polygon | DrawTool.Star | DrawTool.Frame | DrawTool.Stack;

const FRAME_FILL = '#ffffff';

export type LineTool = DrawTool.Line | DrawTool.Arrow;

export const DRAWN_TEXT: ComponentId = 'Text';

const BOX_CLIP: Record<BoxTool, { component: ComponentId; props: Record<string, unknown> }> = {
  [DrawTool.Text]: { component: DRAWN_TEXT, props: { text: 'Text' } },
  [DrawTool.Rectangle]: { component: 'Shape', props: { shape: ShapeKind.Rect } },
  [DrawTool.Ellipse]: { component: 'Shape', props: { shape: ShapeKind.Ellipse } },
  [DrawTool.Polygon]: { component: 'Shape', props: { shape: ShapeKind.Polygon, sides: 3 } },
  [DrawTool.Star]: { component: 'Shape', props: { shape: ShapeKind.Star, points: 5 } },
  [DrawTool.Frame]: { component: 'Shape', props: { shape: ShapeKind.Rect, fills: [{ type: FillType.Solid, color: FRAME_FILL }] } },
  [DrawTool.Stack]: { component: 'Shape', props: { shape: ShapeKind.Rect, fill: 'transparent' } }
};

export const drawsBox = (tool: DrawTool): boolean => tool in BOX_CLIP;

const MIN_PEN_POINTS = 2;
const MIN_SIDE = 0.001;

const SPAN: Record<DocMode, (doc: MotionDoc, frame: number, component: ComponentId) => { from: number; durationInFrames: number }> = {
  [DocMode.Still]: (doc) => ({ from: 0, durationInFrames: doc.durationInFrames }),
  [DocMode.Video]: (doc, frame) => {
    const from = Math.min(Math.max(0, Math.round(frame)), doc.durationInFrames - 1);
    return { from, durationInFrames: Math.max(1, doc.durationInFrames - from) };
  }
};

const DRAW_START: Record<EditMode, (playhead: number) => number> = {
  [EditMode.Design]: () => 0,
  [EditMode.Motion]: (playhead) => playhead
};

export const drawStart = (mode: EditMode, playhead: number): number => DRAW_START[mode](playhead);

const fail = (error: string): OpResult => ({ ok: false, error });

function place(doc: MotionDoc, component: ComponentId, props: Record<string, unknown>, frame: number, id: string): OpResult {
  return addClip(doc, { component, props, ...TOP_LEFT_START, ...SPAN[docMode(doc)](doc, frame, component) }, id);
}

const TEXT_TYPE = COMPONENTS.Text.schema.parse({});
const SIZE_PRECISION = 1000;

function fittedSize(doc: MotionDoc, box: DrawBox): number {
  const fit = (box.height * doc.height) / Math.min(doc.width, doc.height) / TEXT_TYPE.leading;
  return Math.round(Math.min(Math.max(fit, TYPE_SIZE.min), TYPE_SIZE.max) * SIZE_PRECISION) / SIZE_PRECISION;
}

const BOX_SIZED: Record<BoxTool, (doc: MotionDoc, box: DrawBox, sizing: TextSizing) => Record<string, unknown>> = {
  [DrawTool.Text]: (doc, box, sizing) => ({ size: fittedSize(doc, box), sizing }),
  [DrawTool.Rectangle]: () => ({}),
  [DrawTool.Ellipse]: () => ({}),
  [DrawTool.Polygon]: () => ({}),
  [DrawTool.Star]: () => ({}),
  [DrawTool.Frame]: () => ({}),
  [DrawTool.Stack]: () => ({})
};

const STACK_LAYOUT = { direction: Direction.Vertical, gap: 8, padding: { top: 16, right: 16, bottom: 16, left: 16 } };

function finishStack(doc: MotionDoc, id: string): OpResult {
  const laid = setAutoLayout(doc, id, STACK_LAYOUT);
  return laid.ok ? setLayoutItem(laid.doc, id, { width: Sizing.Hug, height: Sizing.Hug }) : laid;
}

const FINISH: Partial<Record<BoxTool, (doc: MotionDoc, id: string) => OpResult>> = {
  [DrawTool.Frame]: (doc, id) => setClipFlags(doc, id, { clipContent: true }),
  [DrawTool.Stack]: finishStack
};

export function drawClip(doc: MotionDoc, tool: DrawTool, box: DrawBox, frame: number, id: string, sizing: TextSizing = NEW_TEXT_SIZING, extra: Record<string, unknown> = {}): OpResult {
  const made = BOX_CLIP[tool as BoxTool];
  if (!made) {
    return fail(`${tool} does not draw a box`);
  }
  const placed = place(doc, made.component, { ...made.props, ...extra, ...BOX_SIZED[tool as BoxTool](doc, box, sizing), ...box }, frame, id);
  return placed.ok ? FINISH[tool as BoxTool]?.(placed.doc, id) ?? placed : placed;
}

const ARROW_HEAD = { length: 0.2, minLength: 12, maxLength: 80, spread: Math.PI / 7 };

function arrowHead(from: DragPoint, to: DragPoint): Pt[] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const length = Math.min(ARROW_HEAD.maxLength, Math.max(ARROW_HEAD.minLength, span * ARROW_HEAD.length));
  const wing = (side: number): Pt => [to.x - length * Math.cos(angle + side * ARROW_HEAD.spread), to.y - length * Math.sin(angle + side * ARROW_HEAD.spread)];
  return [wing(1), [to.x, to.y], wing(-1)];
}

const LINE_ENDS: Record<LineTool, (from: DragPoint, to: DragPoint) => Pt[]> = {
  [DrawTool.Line]: () => [],
  [DrawTool.Arrow]: arrowHead
};

export function lineOutline(from: DragPoint, to: DragPoint, tool: LineTool): Outline {
  const points: Pt[] = [[from.x, from.y], [to.x, to.y], ...LINE_ENDS[tool](from, to)];
  return [{ vertices: points.map(corner), closed: false }];
}

export const LINE_PAINT: Record<LineTool, (ink: string) => PenPaint> = {
  [DrawTool.Line]: (ink) => ({ fill: null, stroke: ink }),
  [DrawTool.Arrow]: (ink) => ({ fill: null, stroke: ink })
};

function boundsOf(outline: Outline): DrawBox {
  const points: Pt[] = outline.flatMap((c) => c.vertices.flatMap((v) => [v.p, v.in, v.out]));
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  return { x: left + width / 2, y: top + height / 2, width, height };
}

const PRECISION = 10000;
const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

export function penClip(doc: MotionDoc, outline: Outline, frame: number, id: string, paint: Record<string, unknown> = {}): OpResult {
  if (outline.reduce((n, c) => n + c.vertices.length, 0) < MIN_PEN_POINTS) {
    return fail('a path needs at least two points');
  }
  const box = boundsOf(outline);
  const left = box.x - box.width / 2;
  const top = box.y - box.height / 2;
  const unit = mapOutline(outline, ([x, y]) => [round(box.width ? (x - left) / box.width : 0), round(box.height ? (y - top) / box.height : 0)]);
  const placed = { x: round(box.x), y: round(box.y), width: round(Math.max(box.width, MIN_SIDE)), height: round(Math.max(box.height, MIN_SIDE)) };
  return place(doc, 'Shape', { shape: ShapeKind.Path, path: pathData(unit), ...paint, ...placed }, frame, id);
}

export type CanvasBox = { left: number; top: number; width: number; height: number };

export enum CanvasTheme {
  Light = 'light',
  Dark = 'dark'
}

export type PenPaint = { fill?: string | null; stroke?: string | null; gradient?: SvgGradient; fillRule?: SvgFillRule };

type BoxDrawn = { tool: BoxTool; box: CanvasBox; theme?: CanvasTheme; sizing?: TextSizing; text?: string; color?: string; weight?: number };

export type Drawn = BoxDrawn | ({ tool: DrawTool.Pen; outline: Outline } & PenPaint);

export type LineWire = { tool: LineTool; from: DragPoint; to: DragPoint; stroke?: string; theme?: CanvasTheme };

export type DrawnWire = BoxDrawn | ({ tool: DrawTool.Pen; path: string } & PenPaint) | LineWire;

const isLine = (wire: DrawnWire): wire is LineWire => wire.tool === DrawTool.Line || wire.tool === DrawTool.Arrow;

export function drawnOf(wire: DrawnWire): Drawn | string {
  if (isLine(wire)) {
    return { tool: DrawTool.Pen, outline: lineOutline(wire.from, wire.to, wire.tool), ...LINE_PAINT[wire.tool](wire.stroke ?? CANVAS_INK[wire.theme ?? CanvasTheme.Light]) };
  }
  if (wire.tool !== DrawTool.Pen) {
    return wire;
  }
  const { path, ...paint } = wire;
  const outline = parsePath(path);
  return typeof outline === 'string' ? outline : { ...paint, outline };
}

export function penPaint({ fill, stroke, gradient, fillRule }: PenPaint): Record<string, unknown> {
  return {
    ...(fillRule ? { fillRule } : {}),
    ...(gradient ? { fills: [gradient] } : {}),
    ...(fill === null ? { fillKind: FillKind.None } : {}),
    ...(fill ? { fillKind: FillKind.Solid, fill } : {}),
    ...(stroke ? { strokeKind: StrokeKind.Solid, stroke } : {})
  };
}

export type DrawnElement = { ok: true; doc: MotionDoc; box: CanvasBox } | { ok: false; error: string };

const PIXELS_PER_CANVAS_PX = 2;
const MIN_DOC_SIDE = 16;
const FULL_BOX: DrawBox = { x: 0.5, y: 0.5, width: 1, height: 1 };

const evenSide = (n: number) => Math.max(MIN_DOC_SIDE, Math.round(n / 2) * 2);

function elementPixels(box: CanvasBox): { width: number; height: number } {
  const long = Math.max(box.width, box.height);
  const short = Math.min(box.width, box.height);
  const scale = Math.min(PIXELS_PER_CANVAS_PX, MAX_SIDE / long, MAX_SHORT_SIDE / short);
  return { width: evenSide(box.width * scale), height: evenSide(box.height * scale) };
}

export function blankElement(box: CanvasBox): OpResult {
  return setStill({ ...newMotionDoc(MotionFormat.Landscape), ...elementPixels(box), background: Background.Transparent }, 0);
}

const SURFACE_ID = 'surface';

function sizedFrame(box: CanvasBox, format: MotionFormat): MotionDoc {
  const doc = format === MotionFormat.Custom ? { ...newMotionDoc(MotionFormat.Landscape), ...elementPixels(box) } : newMotionDoc(format);
  return withSurface(doc, SURFACE_ID);
}

export function drawnFrame(box: CanvasBox, format: MotionFormat = MotionFormat.Custom, stillSeconds?: number): MotionDoc {
  const doc = sizedFrame(box, format);
  if (stillSeconds === undefined) {
    return doc;
  }
  const pinned = setStill(doc, stillSeconds);
  return pinned.ok ? pinned.doc : doc;
}

const MIN_PEN_ELEMENT_SIDE = 24;
const PEN_STROKE_CANVAS_UNITS = 2;
const MAX_STROKE_WIDTH = 0.2;

function canvasBoxOf(outline: Outline): CanvasBox {
  const box = boundsOf(outline);
  const width = Math.max(box.width, MIN_PEN_ELEMENT_SIDE);
  const height = Math.max(box.height, MIN_PEN_ELEMENT_SIDE);
  return { left: box.x - width / 2, top: box.y - height / 2, width, height };
}

const strokeSized = (paint: PenPaint, box: CanvasBox) => (paint.stroke ? { strokeWidth: Math.min(MAX_STROKE_WIDTH, PEN_STROKE_CANVAS_UNITS / Math.min(box.width, box.height)) } : {});

export function drawnElement(drawn: Drawn, id: string): DrawnElement {
  const box = drawn.tool === DrawTool.Pen ? canvasBoxOf(drawn.outline) : drawn.box;
  const blank = blankElement(box);
  if (!blank.ok) {
    return blank;
  }
  const made =
    drawn.tool === DrawTool.Pen
      ? penClip(blank.doc, mapOutline(drawn.outline, ([x, y]) => [(x - box.left) / box.width, (y - box.top) / box.height]), 0, id, { ...penPaint(drawn), ...strokeSized(drawn, box) })
      : drawClip(blank.doc, drawn.tool, FULL_BOX, 0, id, drawn.sizing, drawn.text ? { text: drawn.text, ...(drawn.color ? { color: drawn.color } : {}), ...(drawn.weight ? { weight: drawn.weight } : {}) } : {});
  const theme = drawn.tool === DrawTool.Pen ? CanvasTheme.Light : (drawn.theme ?? CanvasTheme.Light);
  return made.ok ? { ok: true, doc: canvasReady(made.doc, theme), box } : made;
}

export const CANVAS_INK: Record<CanvasTheme, string> = { [CanvasTheme.Light]: '#111111', [CanvasTheme.Dark]: '#f5f5f5' };


function defaultColor(component: string): unknown {
  const parsed = COMPONENTS[component as ComponentId]?.schema.safeParse({});
  return parsed?.success ? (parsed.data as { color?: unknown }).color : undefined;
}

function inked(doc: MotionDoc, ink: string): MotionDoc {
  const brandInk = (c: MotionDoc['tracks'][number]['clips'][number]) => (c.props.color ?? defaultColor(c.component)) === DEFAULT_COLOUR.ink;
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (brandInk(c) ? { ...c, props: { ...c.props, color: ink } } : c)) })) };
}

export const canvasReady = (doc: MotionDoc, theme: CanvasTheme = CanvasTheme.Light): MotionDoc => inked(settledStill(doc), CANVAS_INK[theme]);
