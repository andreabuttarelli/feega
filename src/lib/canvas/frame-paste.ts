import { Background, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { CANVAS_INK, CanvasTheme, drawClip, penClip, penPaint } from '$lib/motion/draw-create';
import { DrawTool } from '$lib/motion/draw-tool';
import { groupClips } from '$lib/motion/group';
import { mapOutline, parsePath, type Pt } from '$lib/motion/shape/geometry';
import { svgShapes } from '$lib/motion/shape/svg-import';
import { TextSizing } from '$lib/motion/text-sizing';

export type FramePaste = { svg: string } | { text: string };
export type Pasted = { doc: MotionDoc; selection: string[] };
type Unit = { x: number; y: number };
type NewId = () => string;

export const TEXT_BOX = { lineHeight: 32, charWidth: 0.55, maxChars: 48 };
export const MAX_PASTED_SHAPES = 200;

const BRAND_TEXT = 'brand.text';
const INK: Record<Background, string> = { [Background.Brand]: BRAND_TEXT, [Background.Transparent]: CANVAS_INK[CanvasTheme.Light] };

const topIds = (doc: MotionDoc) => doc.tracks.flatMap((t) => (t.clips as MotionClip[]).map((c) => c.id));

function pastedSvg(doc: MotionDoc, svg: string, at: Unit, scale: number, frame: number, newId: NewId): Pasted | null {
  const read = svgShapes(svg);
  const centre = { x: at.x * doc.width, y: at.y * doc.height };
  const toUnit = ([x, y]: Pt): Pt => [(centre.x + (x - read.size.width / 2) * scale) / doc.width, (centre.y + (y - read.size.height / 2) * scale) / doc.height];
  let next = doc;
  const ids: string[] = [];
  for (const shape of read.shapes.slice(0, MAX_PASTED_SHAPES)) {
    const outline = parsePath(shape.path);
    const id = newId();
    const made = typeof outline === 'string' ? null : penClip(next, mapOutline(outline, toUnit), frame, id, penPaint(shape));
    if (made?.ok) {
      next = made.doc;
      ids.push(id);
    }
  }
  if (ids.length < 2) {
    return ids.length ? { doc: next, selection: ids } : null;
  }
  const before = new Set(topIds(next));
  const grouped = groupClips(next, ids, newId);
  return grouped.ok ? { doc: grouped.doc, selection: topIds(grouped.doc).filter((id) => !before.has(id)) } : { doc: next, selection: ids };
}

function pastedText(doc: MotionDoc, text: string, at: Unit, scale: number, frame: number, newId: NewId): Pasted | null {
  const longest = Math.min(TEXT_BOX.maxChars, Math.max(...text.split('\n').map((line) => line.length)));
  const width = (longest * TEXT_BOX.lineHeight * TEXT_BOX.charWidth * scale) / doc.width;
  const height = (TEXT_BOX.lineHeight * scale) / doc.height;
  const id = newId();
  const made = drawClip(doc, DrawTool.Text, { x: at.x, y: at.y, width, height }, frame, id, TextSizing.AutoWidth, { text, color: INK[doc.background] });
  return made.ok ? { doc: made.doc, selection: [id] } : null;
}

export function pastedInFrame(doc: MotionDoc, paste: FramePaste, at: Unit, scale: number, frame: number, newId: NewId): Pasted | null {
  return 'svg' in paste ? pastedSvg(doc, paste.svg, at, scale, frame, newId) : pastedText(doc, paste.text, at, scale, frame, newId);
}
