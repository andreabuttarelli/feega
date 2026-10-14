import { COMPONENTS, type ComponentId } from './components';
import type { MotionDoc } from './doc';
import { DrawTool, type DrawBox } from './draw-tool';
import { mapOutline, pathData, type Outline, type Pt } from './shape/geometry';
import { ShapeKind } from './shape/schema';
import { DocMode, docMode } from './still';
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
