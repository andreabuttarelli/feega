import { DrawTool } from '$lib/motion/draw-tool';
import type { CanvasBox, DrawnWire } from '$lib/motion/draw-create';
import { mapOutline, parsePath, pathData } from '$lib/motion/shape/geometry';

type Point = { x: number; y: number };
type DrawnClip = { component: string; props: Record<string, unknown> };
type ToFlow = (screen: Point) => Point;

const TOOL_OF_CLIP: Record<string, DrawTool> = {
  Text: DrawTool.Text,
  'Shape:rect': DrawTool.Rectangle,
  'Shape:ellipse': DrawTool.Ellipse,
  'Shape:path': DrawTool.Pen
};

const toolOf = (clip: DrawnClip): DrawTool | undefined => TOOL_OF_CLIP[clip.component] ?? TOOL_OF_CLIP[`${clip.component}:${String(clip.props.shape)}`];

const num = (value: unknown) => (typeof value === 'number' ? value : 0);

function flowBox(clip: DrawnClip, host: CanvasBox, toFlow: ToFlow): CanvasBox {
  const { x, y, width, height } = { x: num(clip.props.x), y: num(clip.props.y), width: num(clip.props.width), height: num(clip.props.height) };
  const from = toFlow({ x: host.left + (x - width / 2) * host.width, y: host.top + (y - height / 2) * host.height });
  const to = toFlow({ x: host.left + (x + width / 2) * host.width, y: host.top + (y + height / 2) * host.height });
  return { left: from.x, top: from.y, width: to.x - from.x, height: to.y - from.y };
}

export function drawnOnCanvas(clip: DrawnClip, host: CanvasBox, toFlow: ToFlow): DrawnWire | null {
  const tool = toolOf(clip);
  if (!tool || tool === DrawTool.Select) {
    return null;
  }
  const box = flowBox(clip, host, toFlow);
  if (tool !== DrawTool.Pen) {
    return { tool, box };
  }
  const outline = parsePath(String(clip.props.path ?? ''));
  if (typeof outline === 'string') {
    return null;
  }
  return { tool, path: pathData(mapOutline(outline, ([u, v]) => [box.left + u * box.width, box.top + v * box.height])) };
}
