import { COMPONENTS } from './components';
import { FillType } from './fill/model';
import { ShapeKind } from './shape/schema';

const CENTRE = 0.5;

const listed = (value: unknown) => Array.isArray(value) && value.length > 0;

const DRESSES: readonly ((props: Record<string, unknown>) => boolean)[] = [
  (p) => Number(p.roundness ?? 0) > 0,
  (p) => Array.isArray(p.corners) && p.corners.some((c) => Number(c) > 0),
  (p) => listed(p.fills),
  (p) => listed(p.strokes)
];

export const dressedImage = (props: Record<string, unknown>): boolean => DRESSES.some((dress) => dress(props));

export function imageRectangle(props: Record<string, unknown>): Record<string, unknown> | null {
  if (!dressedImage(props)) {
    return null;
  }
  const picture = { type: FillType.Image, assetId: String(props.assetId ?? ''), fit: props.fit, focus: { x: Number(props.focusX ?? CENTRE), y: Number(props.focusY ?? CENTRE) }, scale: Number(props.zoom ?? 1) };
  const fills = [picture, ...((props.fills as unknown[] | undefined) ?? [])];
  const shaped = COMPONENTS.Shape.schema.safeParse({ shape: ShapeKind.Rect, roundness: props.roundness, corners: props.corners, smoothing: props.smoothing, fills, strokes: props.strokes, x: props.x, y: props.y, width: props.width, height: props.height });
  return shaped.success ? (shaped.data as Record<string, unknown>) : null;
}
