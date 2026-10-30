import type { RestNode, RestPaint } from '$lib/server/figma/rest-message';

const WHOLE = new Set(['TEXT', 'VECTOR']);
const CENTRED_EDGE = 0.5;

export type Window = { left: number; top: number; right: number; bottom: number };

const edgeOf = (cutStart: boolean, cutEnd: boolean) => (cutStart ? 1 : cutEnd ? 0 : CENTRED_EDGE);

function cutPaints(fills: RestPaint[] | undefined, focus: RestPaint['imageFocus']): RestPaint[] | undefined {
  return fills?.map((p) => (p.imageRef ? { ...p, scaleMode: 'FILL', imageFocus: focus } : p));
}

export function windowed(n: RestNode, w: Window): RestNode | null {
  const b = n.absoluteBoundingBox!;
  if (WHOLE.has(n.type)) {
    return b.y >= w.top && b.y < w.bottom && b.x < w.right && b.x + b.width > w.left ? n : null;
  }
  const kids = n.children?.flatMap((c) => windowed(c, w) ?? []);
  const overlaps = b.y < w.bottom && b.y + b.height > w.top && b.x < w.right && b.x + b.width > w.left;
  if (!overlaps && !kids?.length) {
    return null;
  }
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const [x0, x1, y0, y1] = [clamp(b.x, w.left, w.right), clamp(b.x + b.width, w.left, w.right), clamp(b.y, w.top, w.bottom), clamp(b.y + b.height, w.top, w.bottom)];
  const [cutLeft, cutRight, cutTop, cutBottom] = [x0 > b.x, x1 < b.x + b.width, y0 > b.y, y1 < b.y + b.height];
  const cut = cutLeft || cutRight || cutTop || cutBottom ? { layoutMode: undefined, fills: cutPaints(n.fills, { x: edgeOf(cutLeft, cutRight), y: edgeOf(cutTop, cutBottom) }) } : {};
  return { ...n, absoluteBoundingBox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, ...cut, ...(n.children ? { children: kids } : {}) };
}
