import { MaskKind, MaskMode, MASK_KEYS, MASK_PROPS, type Mask } from '../mask';
import { sampleTrack } from '../sample-track';
import { ellipseOutline, flatten, rectOutline, type Outline } from '../shape/geometry';
import { mul2d, type Affine } from '../affine';

export enum CoverKind {
  Path = 'path',
  Ramp = 'ramp',
  Picture = 'picture'
}

export enum RampKind {
  Linear = 'linear',
  Radial = 'radial'
}

export type Cover =
  | { kind: CoverKind.Path; contours: number[][]; matrix: Affine }
  | { kind: CoverKind.Ramp; ramp: RampKind; contours: number[][]; matrix: Affine }
  | { kind: CoverKind.Picture; src: string; luma: boolean; matrix: Affine };

export type MaskLayer = { mode: MaskMode; invert: boolean; level: number; feather: number; cover: Cover };

type Frame = { width: number; height: number };
type Keyed = Record<string, { frame: number; value: number | string; ease: string | number[] }[] | undefined>;

const UNIT = { w: 1, h: 1 };
const DEG = Math.PI / 180;

const flat = (outline: Outline): number[][] => outline.map((c) => flatten(c).flatMap(([x, y]) => [x, y]));

const SHAPES: Partial<Record<MaskKind, (m: Mask) => number[][]>> = {
  [MaskKind.Rect]: () => flat(rectOutline(0, UNIT)),
  [MaskKind.Ellipse]: () => flat(ellipseOutline(UNIT)),
  [MaskKind.Polygon]: (m) => [m.points.flatMap(([x, y]) => [x, y])],
  [MaskKind.Linear]: () => flat(rectOutline(0, UNIT)),
  [MaskKind.Radial]: () => flat(ellipseOutline(UNIT))
};

const RAMPS: Partial<Record<MaskKind, RampKind>> = { [MaskKind.Linear]: RampKind.Linear, [MaskKind.Radial]: RampKind.Radial };
const PICTURES: Partial<Record<MaskKind, boolean>> = { [MaskKind.Image]: false, [MaskKind.Luma]: true };

function valuesAt(mask: Mask, keys: Keyed, local: number): Mask {
  const sampled = MASK_KEYS.flatMap((key) => {
    const track = keys[key];
    return track?.length ? [[MASK_PROPS[key].field, sampleTrack(track, local)]] : [];
  });
  return { ...mask, ...Object.fromEntries(sampled) };
}

function placement(m: Mask, frame: Frame, world: Affine): Affine {
  const w = m.width * frame.width + 2 * m.expansion;
  const h = m.height * frame.height + 2 * m.expansion;
  const c = Math.cos(m.rotation * DEG);
  const s = Math.sin(m.rotation * DEG);
  const centred: Affine = [c * w, s * w, -s * h, c * h, m.x * frame.width - (c * w - s * h) / 2, m.y * frame.height - (s * w + c * h) / 2];
  return mul2d(world, centred);
}

function coverOf(m: Mask, matrix: Affine, asset: (id: string | null) => string | null): Cover | null {
  const picture = PICTURES[m.kind];
  if (picture !== undefined) {
    const src = asset(m.assetId);
    return src ? { kind: CoverKind.Picture, src, luma: picture, matrix } : null;
  }
  const shape = SHAPES[m.kind];
  if (!shape) {
    return null;
  }
  const ramp = RAMPS[m.kind];
  return ramp ? { kind: CoverKind.Ramp, ramp, contours: shape(m), matrix } : { kind: CoverKind.Path, contours: shape(m), matrix };
}

export type Masked = { mask: Mask | null; maskStack: Mask[]; keyframes: Keyed; from: number };

export function maskLayers(clip: Masked, frame: number, size: Frame, world: Affine, asset: (id: string | null) => string | null): MaskLayer[] | null {
  if (!clip.mask) {
    return [];
  }
  const all = [valuesAt(clip.mask, clip.keyframes, frame - clip.from), ...clip.maskStack];
  const layers = all.map((m) => {
    const cover = coverOf(m, placement(m, size, world), asset);
    return cover ? { mode: m.mode, invert: m.invert, level: m.opacity, feather: m.feather, cover } : null;
  });
  return layers.every(Boolean) ? (layers as MaskLayer[]) : null;
}
