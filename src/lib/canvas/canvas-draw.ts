import { DrawTool } from '$lib/motion/draw-tool';
import { NEW_TEXT_SIZING, TEXT_SIZINGS } from '@feega/motion-core/motion/text-sizing';
import { CANVAS_INK, CanvasTheme, drawClip, drawnElement, drawnOf, penClip, penInk, type CanvasBox, type DrawnWire, type PenPaint } from '$lib/motion/draw-create';
import { mapOutline, parsePath, pathData } from '@feega/motion-core/motion/shape/geometry';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { COMPONENTS } from '@feega/motion-core/motion/components';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { joinStackAt } from '$lib/motion/layout/stack-drag';

type Point = { x: number; y: number };
type DrawnClip = { component: string; props: Record<string, unknown>; autoLayout?: unknown };
type ToFlow = (screen: Point) => Point;

const TOOL_OF_CLIP: Record<string, DrawTool> = {
  Text: DrawTool.Text,
  'Shape:rect': DrawTool.Rectangle,
  'Shape:ellipse': DrawTool.Ellipse,
  'Shape:polygon': DrawTool.Polygon,
  'Shape:star': DrawTool.Star,
  'Shape:path': DrawTool.Pen
};

const toolOf = (clip: DrawnClip): DrawTool | undefined => (clip.autoLayout ? DrawTool.Stack : (TOOL_OF_CLIP[clip.component] ?? TOOL_OF_CLIP[`${clip.component}:${String(clip.props.shape)}`]));

export const TEXT_CLICK_PX = { size: 16, width: 160 };

const TEXT_LEADING = Number(COMPONENTS.Text.schema.parse({}).leading);

export function canvasTextClick(toFlow: ToFlow): { width: number; height: number } {
  const zoom = 1 / (toFlow({ x: 1, y: 0 }).x - toFlow({ x: 0, y: 0 }).x);
  return { width: TEXT_CLICK_PX.width * zoom, height: TEXT_CLICK_PX.size * TEXT_LEADING * zoom };
}

const SOLID = 'solid';
const NO_FILL = 'none';

function strokedPaint(props: Record<string, unknown>, theme: CanvasTheme): PenPaint {
  const filled = props.strokeKind === SOLID && props.fillKind !== NO_FILL;
  return { fill: filled ? CANVAS_INK[theme] : null, stroke: CANVAS_INK[theme] };
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

export const docPoint = (doc: MotionDoc, frame: FrameBox, at: Point): [number, number] => [((at.x - frame.x) / frame.w) * doc.width, ((at.y - frame.y) / frame.h) * doc.height];

export function drawnInFrame(doc: MotionDoc, frame: FrameBox, wire: DrawnWire, at: number, id: string): OpResult {
  const drawn = drawnOf(wire);
  if (typeof drawn === 'string') {
    return { ok: false, error: drawn };
  }
  if (drawn.tool === DrawTool.Pen) {
    const outline = mapOutline(drawn.outline, ([x, y]) => [(x - frame.x) / frame.w, (y - frame.y) / frame.h]);
    return penClip(doc, outline, at, id, penInk(doc));
  }
  const { left, top, width, height } = drawn.box;
  const box = { x: (left + width / 2 - frame.x) / frame.w, y: (top + height / 2 - frame.y) / frame.h, width: width / frame.w, height: height / frame.h };
  const made = drawClip(doc, drawn.tool, box, at, id, drawn.sizing ?? NEW_TEXT_SIZING);
  const anchor = drawnAnchor(wire);
  return made.ok && anchor ? joinStackAt(made.doc, id, docPoint(doc, frame, anchor)) : made;
}

export function drawnAnchor(wire: DrawnWire): Point | null {
  const drawn = drawnOf(wire);
  const made = typeof drawn === 'string' ? null : drawnElement(drawn, '');
  if (!made?.ok) {
    return null;
  }
  const { left, top, width, height } = made.box;
  return { x: wire.tool === DrawTool.Text ? left : left + width / 2, y: top + height / 2 };
}
