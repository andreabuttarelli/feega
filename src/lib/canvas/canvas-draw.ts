import { DrawTool } from '$lib/motion/draw-tool';
import { NEW_TEXT_SIZING, TEXT_SIZINGS } from '@feega/motion-core/motion/text-sizing';
import { CANVAS_INK, CanvasTheme, LINE_PAINT, drawClip, drawnElement, drawnOf, penClip, penPaint, type CanvasBox, type DrawnWire, type PenPaint } from '$lib/motion/draw-create';
import { mapOutline, parsePath, pathData } from '@feega/motion-core/motion/shape/geometry';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';

type Point = { x: number; y: number };
type DrawnClip = { component: string; props: Record<string, unknown> };
type ToFlow = (screen: Point) => Point;

const TOOL_OF_CLIP: Record<string, DrawTool> = {
  Text: DrawTool.Text,
  'Shape:rect': DrawTool.Rectangle,
  'Shape:ellipse': DrawTool.Ellipse,
  'Shape:polygon': DrawTool.Polygon,
  'Shape:star': DrawTool.Star,
  'Shape:path': DrawTool.Pen
};

const toolOf = (clip: DrawnClip): DrawTool | undefined => TOOL_OF_CLIP[clip.component] ?? TOOL_OF_CLIP[`${clip.component}:${String(clip.props.shape)}`];

const SOLID = 'solid';
const NO_FILL = 'none';

function strokedPaint(props: Record<string, unknown>, theme: CanvasTheme): PenPaint {
  if (props.strokeKind !== SOLID) {
    return {};
  }
  return { fill: props.fillKind === NO_FILL ? null : CANVAS_INK[theme], stroke: CANVAS_INK[theme] };
}

const num = (value: unknown) => (typeof value === 'number' ? value : 0);

function flowBox(clip: DrawnClip, host: CanvasBox, toFlow: ToFlow): CanvasBox {
  const { x, y, width, height } = { x: num(clip.props.x), y: num(clip.props.y), width: num(clip.props.width), height: num(clip.props.height) };
  const from = toFlow({ x: host.left + (x - width / 2) * host.width, y: host.top + (y - height / 2) * host.height });
  const to = toFlow({ x: host.left + (x + width / 2) * host.width, y: host.top + (y + height / 2) * host.height });
  return { left: from.x, top: from.y, width: to.x - from.x, height: to.y - from.y };
}

export function drawnOnCanvas(clip: DrawnClip, host: CanvasBox, toFlow: ToFlow, theme: CanvasTheme = CanvasTheme.Light): DrawnWire | null {
  const tool = toolOf(clip);
  if (!tool || tool === DrawTool.Select) {
    return null;
  }
  const box = flowBox(clip, host, toFlow);
  if (tool !== DrawTool.Pen) {
    const sizing = TEXT_SIZINGS.find((v) => v === clip.props.sizing);
    return { tool, box, theme, sizing } as DrawnWire;
  }
  const outline = parsePath(String(clip.props.path ?? ''));
  if (typeof outline === 'string') {
    return null;
  }
  return { tool, path: pathData(mapOutline(outline, ([u, v]) => [box.left + u * box.width, box.top + v * box.height])), ...strokedPaint(clip.props, theme) };
}

type FrameBox = { x: number; y: number; w: number; h: number };

const FRAME_INK = 'brand.text';

const framePaint = (stroked: boolean): Record<string, unknown> => (stroked ? penPaint(LINE_PAINT[DrawTool.Line](FRAME_INK)) : {});

export function drawnInFrame(doc: MotionDoc, frame: FrameBox, wire: DrawnWire, at: number, id: string): OpResult {
  const drawn = drawnOf(wire);
  if (typeof drawn === 'string') {
    return { ok: false, error: drawn };
  }
  if (drawn.tool === DrawTool.Pen) {
    const outline = mapOutline(drawn.outline, ([x, y]) => [(x - frame.x) / frame.w, (y - frame.y) / frame.h]);
    return penClip(doc, outline, at, id, framePaint(Boolean(drawn.stroke)));
  }
  const { left, top, width, height } = drawn.box;
  const box = { x: (left + width / 2 - frame.x) / frame.w, y: (top + height / 2 - frame.y) / frame.h, width: width / frame.w, height: height / frame.h };
  return drawClip(doc, drawn.tool, box, at, id, drawn.sizing ?? NEW_TEXT_SIZING);
}

export function drawnCentre(wire: DrawnWire): Point | null {
  const drawn = drawnOf(wire);
  const made = typeof drawn === 'string' ? null : drawnElement(drawn, '');
  return made?.ok ? { x: made.box.left + made.box.width / 2, y: made.box.top + made.box.height / 2 } : null;
}
