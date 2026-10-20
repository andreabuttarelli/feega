import { mul2d, type Affine } from '$lib/motion/affine';
import { BlendMode } from '$lib/motion/blend';
import { ItemKind, type DisplayList, type Item, type Linear, type PathItem, type Scissor } from '$lib/motion/gpu-full/display-list';
import { FillRule, PaintKind } from '$lib/motion/gpu-full/paint';
import type { Rgba } from '$lib/motion/gpu-full/rgba';
import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';

export type Box = { x: number; y: number; w: number; h: number };
export type FrameOnCanvas = { id: string; box: Box; list: DisplayList };
export type SceneLook = { background: Rgba; selection: Rgba; selectionWidth: number };

const rectContour = ([x0, y0, x1, y1]: Scissor) => [x0, y0, x1, y0, x1, y1, x0, y1];

const onScreen = (view: Viewport, b: Box): Scissor => [view.x + b.x * view.zoom, view.y + b.y * view.zoom, view.x + (b.x + b.w) * view.zoom, view.y + (b.y + b.h) * view.zoom];

const visible = ([x0, y0, x1, y1]: Scissor, screen: Screen) => x1 >= 0 && y1 >= 0 && x0 <= screen.width && y0 <= screen.height;

const solid = (clip: string, contours: number[][], color: Rgba, rule = FillRule.NonZero): PathItem => ({ kind: ItemKind.Path, clip, contours, rule, paint: { kind: PaintKind.Solid, color }, opacity: 1, matrix: [1, 0, 0, 1, 0, 0], blur: 0, blend: BlendMode.Normal });

function scissorThrough(m: Affine, rect: Scissor, own?: Scissor): Scissor {
  if (!own) {
    return rect;
  }
  const [x0, y0] = [m[0] * own[0] + m[4], m[3] * own[1] + m[5]];
  const [x1, y1] = [m[0] * own[2] + m[4], m[3] * own[3] + m[5]];
  return [Math.max(rect[0], x0), Math.max(rect[1], y0), Math.min(rect[2], x1), Math.min(rect[3], y1)];
}

const linearThrough = (m: Affine, s: Linear): Linear => {
  const [a, b, c, d] = mul2d(m, [s[0], s[1], s[2], s[3], 0, 0]);
  return [a, b, c, d];
};

function placed(item: Item, m: Affine, rect: Scissor, scale: number): Item {
  const masks = item.masks?.map((l) => ({ ...l, feather: l.feather * scale, cover: { ...l.cover, matrix: mul2d(m, l.cover.matrix) } }));
  const matte = item.matte && { ...item.matte, items: item.matte.items.map((i) => placed(i, m, rect, scale)) };
  return {
    ...item,
    matrix: mul2d(m, item.matrix),
    blur: item.blur * scale,
    scissor: scissorThrough(m, rect, item.scissor),
    ...(masks ? { masks } : {}),
    ...(matte ? { matte } : {}),
    ...(item.kind === ItemKind.Group ? { items: item.items.map((i) => placed(i, m, rect, scale)) } : {}),
    ...(item.space ? { space: linearThrough(m, item.space) } : {})
  };
}

function frameItems(f: FrameOnCanvas, view: Viewport, rect: Scissor): Item[] {
  const sx = (f.box.w * view.zoom) / f.list.width;
  const sy = (f.box.h * view.zoom) / f.list.height;
  const m: Affine = [sx, 0, 0, sy, rect[0], rect[1]];
  const background = f.list.background ? [solid(`frame:${f.id}`, [rectContour(rect)], f.list.background)] : [];
  return [...background, ...f.list.items.map((i) => placed(i, m, rect, Math.min(sx, sy)))];
}

function ring(id: string, [x0, y0, x1, y1]: Scissor, look: SceneLook): PathItem {
  const w = look.selectionWidth;
  return solid(`selection:${id}`, [rectContour([x0 - w, y0 - w, x1 + w, y1 + w]), rectContour([x0, y0, x1, y1])], look.selection, FillRule.EvenOdd);
}

export function canvasScene(frames: FrameOnCanvas[], view: Viewport, screen: Screen, selected: ReadonlySet<string>, look: SceneLook): DisplayList {
  const shown = frames.map((f) => ({ f, rect: onScreen(view, f.box) })).filter(({ rect }) => visible(rect, screen));
  const rings = shown.filter(({ f }) => selected.has(f.id)).map(({ f, rect }) => ring(f.id, rect, look));
  return {
    width: screen.width,
    height: screen.height,
    background: look.background,
    items: [...shown.flatMap(({ f, rect }) => frameItems(f, view, rect)), ...rings],
    unsupported: shown.flatMap(({ f }) => f.list.unsupported)
  };
}
