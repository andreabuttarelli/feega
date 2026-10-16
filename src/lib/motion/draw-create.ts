import { COMPONENTS, type ComponentId } from './components';
import { Background, MAX_SHORT_SIDE, MAX_SIDE, MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { DrawTool, type DrawBox } from './draw-tool';
import { mapOutline, parsePath, pathData, type Outline, type Pt } from './shape/geometry';
import { ShapeKind } from './shape/schema';
import { DocMode, docMode, setStill, settledStill } from './still';
import { addClip, type OpResult } from './timeline';

type BoxTool = DrawTool.Text | DrawTool.Rectangle | DrawTool.Ellipse;

const BOX_CLIP: Record<BoxTool, { component: ComponentId; props: Record<string, unknown> }> = {
  [DrawTool.Text]: { component: 'Text', props: { text: 'Text' } },
  [DrawTool.Rectangle]: { component: 'Shape', props: { shape: ShapeKind.Rect } },
  [DrawTool.Ellipse]: { component: 'Shape', props: { shape: ShapeKind.Ellipse } }
};

const MIN_PEN_POINTS = 2;
const MIN_SIDE = 0.001;

const SPAN: Record<DocMode, (doc: MotionDoc, frame: number, component: ComponentId) => { from: number; durationInFrames: number }> = {
  [DocMode.Still]: (doc) => ({ from: 0, durationInFrames: doc.durationInFrames }),
  [DocMode.Video]: (doc, frame, component) => {
    const from = Math.min(Math.max(0, Math.round(frame)), doc.durationInFrames - 1);
    return { from, durationInFrames: Math.max(1, Math.min(COMPONENTS[component].durationInFrames, doc.durationInFrames - from)) };
  }
};

const fail = (error: string): OpResult => ({ ok: false, error });

function place(doc: MotionDoc, component: ComponentId, props: Record<string, unknown>, frame: number, id: string): OpResult {
  return addClip(doc, { component, props, ...SPAN[docMode(doc)](doc, frame, component) }, id);
}

export function drawClip(doc: MotionDoc, tool: DrawTool, box: DrawBox, frame: number, id: string): OpResult {
  const made = BOX_CLIP[tool as BoxTool];
  if (!made) {
    return fail(`${tool} does not draw a box`);
  }
  return place(doc, made.component, { ...made.props, ...box }, frame, id);
}

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

export function penClip(doc: MotionDoc, outline: Outline, frame: number, id: string): OpResult {
  if (outline.reduce((n, c) => n + c.vertices.length, 0) < MIN_PEN_POINTS) {
    return fail('a path needs at least two points');
  }
  const box = boundsOf(outline);
  const left = box.x - box.width / 2;
  const top = box.y - box.height / 2;
  const unit = mapOutline(outline, ([x, y]) => [round(box.width ? (x - left) / box.width : 0), round(box.height ? (y - top) / box.height : 0)]);
  const placed = { x: round(box.x), y: round(box.y), width: round(Math.max(box.width, MIN_SIDE)), height: round(Math.max(box.height, MIN_SIDE)) };
  return place(doc, 'Shape', { shape: ShapeKind.Path, path: pathData(unit), ...placed }, frame, id);
}

export type CanvasBox = { left: number; top: number; width: number; height: number };

export type Drawn = { tool: BoxTool; box: CanvasBox } | { tool: DrawTool.Pen; outline: Outline };

export type DrawnWire = { tool: BoxTool; box: CanvasBox } | { tool: DrawTool.Pen; path: string };

export function drawnOf(wire: DrawnWire): Drawn | string {
  if (wire.tool !== DrawTool.Pen) {
    return wire;
  }
  const outline = parsePath(wire.path);
  return typeof outline === 'string' ? outline : { tool: DrawTool.Pen, outline };
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

export function drawnFrame(box: CanvasBox): MotionDoc {
  return { ...newMotionDoc(MotionFormat.Landscape), ...elementPixels(box) };
}

function canvasBoxOf(outline: Outline): CanvasBox {
  const box = boundsOf(outline);
  return { left: box.x - box.width / 2, top: box.y - box.height / 2, width: Math.max(box.width, MIN_SIDE), height: Math.max(box.height, MIN_SIDE) };
}

export function drawnElement(drawn: Drawn, id: string): DrawnElement {
  const box = drawn.tool === DrawTool.Pen ? canvasBoxOf(drawn.outline) : drawn.box;
  const blank = blankElement(box);
  if (!blank.ok) {
    return blank;
  }
  const made =
    drawn.tool === DrawTool.Pen
      ? penClip(blank.doc, mapOutline(drawn.outline, ([x, y]) => [(x - box.left) / box.width, (y - box.top) / box.height]), 0, id)
      : drawClip(blank.doc, drawn.tool, FULL_BOX, 0, id);
  return made.ok ? { ok: true, doc: canvasReady(made.doc), box } : made;
}

export const CANVAS_INK = '#111111';
const BRAND_TEXT = 'brand.text';

function defaultColor(component: string): unknown {
  const parsed = COMPONENTS[component as ComponentId]?.schema.safeParse({});
  return parsed?.success ? (parsed.data as { color?: unknown }).color : undefined;
}

function inked(doc: MotionDoc): MotionDoc {
  const brandInk = (c: MotionDoc['tracks'][number]['clips'][number]) => (c.props.color ?? defaultColor(c.component)) === BRAND_TEXT;
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (brandInk(c) ? { ...c, props: { ...c.props, color: CANVAS_INK } } : c)) })) };
}

export const canvasReady = (doc: MotionDoc): MotionDoc => inked(settledStill(doc));
