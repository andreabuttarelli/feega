import { COMPONENTS, TrackKind, type ComponentId } from './components';
import { flatten } from './shape/geometry';
import { resample } from './shape/morph';
import { baseOutline, type ShapeLook } from './shape/render';
import { ShapeKind } from './shape/schema';
import { findClip, type MotionClip, type MotionDoc } from './doc';
import { MaskKind, Matte, maskSchema, type Mask, type MaskInput } from './mask';

type Box = { x: number; y: number; width: number; height: number; rotation?: number; opacity?: number };
type Props = Box & { text?: string; shape?: string; assetId?: string | null };

const boxOf = (p: Props): Omit<MaskInput, 'kind'> => ({ x: p.x, y: p.y, width: p.width, height: p.height, rotation: p.rotation ?? 0, opacity: p.opacity ?? 1 });

const textMatte = (p: Props): MaskInput => ({ ...boxOf(p), kind: MaskKind.Text, text: (p.text ?? '').replace(/\s*\n\s*/g, ' ') });

const PICTURE: Record<Exclude<Matte, Matte.None>, MaskKind> = { [Matte.Alpha]: MaskKind.Image, [Matte.Luma]: MaskKind.Luma };

const pictureMatte = (p: Props, matte: Exclude<Matte, Matte.None>): MaskInput | null => (p.assetId ? { ...boxOf(p), kind: PICTURE[matte], assetId: p.assetId } : null);

const MAX_MASK_POINTS = 64;
const clampUnit = (n: number) => Math.min(1, Math.max(0, Math.round(n * 10000) / 10000));

function outlinePoints(p: Props): [number, number][] {
  const [contour] = baseOutline(COMPONENTS.Shape.schema.parse(p) as unknown as ShapeLook, { w: 1, h: 1 });
  if (!contour) {
    return [];
  }
  const flat = flatten(contour);
  const points = flat.length > MAX_MASK_POINTS ? resample(contour, MAX_MASK_POINTS) : flat;
  return points.map(([x, y]) => [clampUnit(x), clampUnit(y)]);
}

const box = (kind: MaskKind) => (p: Props): MaskInput => ({ ...boxOf(p), kind });

const SHAPE: Record<ShapeKind, (p: Props) => MaskInput> = {
  [ShapeKind.Rect]: box(MaskKind.Rect),
  [ShapeKind.Line]: box(MaskKind.Rect),
  [ShapeKind.Circle]: box(MaskKind.Ellipse),
  [ShapeKind.Ellipse]: box(MaskKind.Ellipse),
  [ShapeKind.Polygon]: (p) => ({ ...boxOf(p), kind: MaskKind.Polygon, points: outlinePoints(p) }),
  [ShapeKind.Star]: (p) => ({ ...boxOf(p), kind: MaskKind.Polygon, points: outlinePoints(p) }),
  [ShapeKind.Path]: (p) => ({ ...boxOf(p), kind: MaskKind.Polygon, points: outlinePoints(p) })
};

const MATTE: Partial<Record<ComponentId, (p: Props, matte: Exclude<Matte, Matte.None>) => MaskInput | null>> = {
  Title: textMatte,
  Text: textMatte,
  Kicker: textMatte,
  Caption: textMatte,
  Shape: (p) => SHAPE[(p.shape as ShapeKind) ?? ShapeKind.Rect](p),
  Image: pictureMatte,
  Logo: pictureMatte
};

export function matteMask(source: MotionClip, matte: Matte): Mask | null {
  const build = MATTE[source.component];
  if (matte === Matte.None || !build) {
    return null;
  }
  const input = build(source.props as Props, matte);
  const parsed = input ? maskSchema.safeParse(input) : null;
  return parsed?.success ? parsed.data : null;
}

const overlap = (a: MotionClip, b: MotionClip) => Math.min(a.from + a.durationInFrames, b.from + b.durationInFrames) - Math.max(a.from, b.from);

export function matteSource(doc: MotionDoc, clipId: string): MotionClip | null {
  const found = findClip(doc, clipId);
  const index = found ? doc.tracks.indexOf(found.track) : -1;
  const above = doc.tracks[index - 1];
  if (!found || !above || above.kind !== TrackKind.Visual) {
    return null;
  }

  const candidates = (above.clips as MotionClip[]).filter((c) => overlap(c, found.clip) > 0);
  return candidates.sort((a, b) => overlap(b, found.clip) - overlap(a, found.clip))[0] ?? null;
}

export function hiddenMattes(doc: MotionDoc): Set<string> {
  const matted = doc.tracks.flatMap((t) => (t.clips as MotionClip[]).filter((c) => c.matte !== Matte.None));
  return new Set(matted.flatMap((c) => matteSource(doc, c.id)?.id ?? []));
}
