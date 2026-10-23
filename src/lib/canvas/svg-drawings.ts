import type { CanvasBox, DrawnWire } from '$lib/motion/draw-create';
import { DrawTool } from '$lib/motion/draw-tool';
import { mapOutline, parsePath, pathData } from '$lib/motion/shape/geometry';
import { svgShapes } from '$lib/motion/shape/svg-import';
import { TextSizing } from '$lib/motion/text-sizing';
import { MAX_PASTED_SHAPES, MAX_PASTED_TEXTS, svgTextBox } from '$lib/canvas/frame-paste';

type Point = { x: number; y: number };

export type SvgDrawing = { wire: DrawnWire; box: CanvasBox };

function shifted(path: string, dx: number, dy: number): { path: string; box: CanvasBox } | null {
  const outline = parsePath(path);
  if (typeof outline === 'string') {
    return null;
  }
  const moved = mapOutline(outline, ([x, y]) => [x + dx, y + dy]);
  const xs = moved.flatMap((c) => c.vertices.map((v) => v.p[0]));
  const ys = moved.flatMap((c) => c.vertices.map((v) => v.p[1]));
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { path: pathData(moved), box: { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top } };
}

export function svgDrawings(svg: string, at: Point): SvgDrawing[] {
  const read = svgShapes(svg);
  const dx = at.x - read.size.width / 2;
  const dy = at.y - read.size.height / 2;
  const pens = read.shapes.slice(0, MAX_PASTED_SHAPES).flatMap((shape): SvgDrawing[] => {
    const moved = shifted(shape.path, dx, dy);
    if (!moved) {
      return [];
    }
    const wire: DrawnWire = { tool: DrawTool.Pen, path: moved.path, fill: shape.fill, stroke: shape.stroke, ...(shape.gradient ? { gradient: shape.gradient } : {}) };
    return [{ wire, box: moved.box }];
  });
  const texts = read.texts.slice(0, MAX_PASTED_TEXTS).map((text): SvgDrawing => {
    const box = svgTextBox(text);
    const placed = { ...box, left: box.left + dx, top: box.top + dy };
    return { wire: { tool: DrawTool.Text, box: placed, text: text.text, sizing: TextSizing.AutoWidth, color: text.fill, weight: text.weight }, box: placed };
  });
  return [...pens, ...texts];
}
