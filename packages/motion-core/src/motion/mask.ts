import { z } from 'zod';

export enum MaskKind {
  Rect = 'rect',
  Ellipse = 'ellipse',
  Polygon = 'polygon',
  Image = 'image',
  Luma = 'luma',
  Text = 'text',
  Linear = 'linear',
  Radial = 'radial'
}

export enum Matte {
  None = 'none',
  Alpha = 'alpha',
  AlphaInverted = 'alpha-inverted',
  Luma = 'luma',
  LumaInverted = 'luma-inverted'
}

export const MATTE_LABEL: Record<Matte, string> = {
  [Matte.None]: 'None',
  [Matte.Alpha]: 'Alpha of the clip above',
  [Matte.AlphaInverted]: 'Inverted alpha of the clip above',
  [Matte.Luma]: 'Luma of the clip above',
  [Matte.LumaInverted]: 'Inverted luma of the clip above'
};

export enum MaskMode {
  Add = 'add',
  Subtract = 'subtract',
  Intersect = 'intersect',
  Difference = 'difference'
}

type Fold = { seed: number; fold: (kept: number, level: number) => number };

const FOLD: Record<MaskMode, Fold> = {
  [MaskMode.Add]: { seed: 0, fold: (kept, level) => kept + level - kept * level },
  [MaskMode.Subtract]: { seed: 1, fold: (kept, level) => kept * (1 - level) },
  [MaskMode.Intersect]: { seed: 1, fold: (kept, level) => kept * level },
  [MaskMode.Difference]: { seed: 0, fold: (kept, level) => kept + level - 2 * kept * level }
};

export const MASK_MODES = Object.values(MaskMode) as [MaskMode, ...MaskMode[]];
export const MAX_MASK_STACK = 7;

export type MaskLevel = { mode: MaskMode; level: number };

export function combineMasks(levels: MaskLevel[]): number {
  const seed = levels.length ? FOLD[levels[0].mode].seed : 0;
  return levels.reduce((kept, { mode, level }) => FOLD[mode].fold(kept, level), seed);
}

export enum Needs {
  Nothing = 'nothing',
  Points = 'points',
  Asset = 'asset',
  Text = 'text'
}

export const MASK_KINDS: Record<MaskKind, { label: string; needs: Needs; box: number }> = {
  [MaskKind.Rect]: { label: 'Rectangle', needs: Needs.Nothing, box: 0.5 },
  [MaskKind.Ellipse]: { label: 'Ellipse', needs: Needs.Nothing, box: 0.5 },
  [MaskKind.Polygon]: { label: 'Polygon', needs: Needs.Points, box: 0.5 },
  [MaskKind.Image]: { label: 'Picture alpha', needs: Needs.Asset, box: 1 },
  [MaskKind.Luma]: { label: 'Picture luminance', needs: Needs.Asset, box: 1 },
  [MaskKind.Text]: { label: 'Text', needs: Needs.Text, box: 0.5 },
  [MaskKind.Linear]: { label: 'Linear gradient', needs: Needs.Nothing, box: 1 },
  [MaskKind.Radial]: { label: 'Radial gradient', needs: Needs.Nothing, box: 1 }
};

export const MASK_KIND_IDS = Object.values(MaskKind) as [MaskKind, ...MaskKind[]];
export const MATTES = Object.values(Matte) as [Matte, ...Matte[]];

type Range = { field: MaskField; label: string; min: number; max: number; step: number; fallback: number };
type MaskField = 'x' | 'y' | 'width' | 'height' | 'rotation' | 'feather' | 'expansion' | 'opacity';

export const MASK_PROPS = {
  maskX: { field: 'x', label: 'Mask X', min: -30, max: 30, step: 0.01, fallback: 0.5 },
  maskY: { field: 'y', label: 'Mask Y', min: -30, max: 30, step: 0.01, fallback: 0.5 },
  maskWidth: { field: 'width', label: 'Mask width', min: 0, max: 60, step: 0.01, fallback: 0.5 },
  maskHeight: { field: 'height', label: 'Mask height', min: 0, max: 60, step: 0.01, fallback: 0.5 },
  maskRotation: { field: 'rotation', label: 'Mask rotation', min: -1080, max: 1080, step: 1, fallback: 0 },
  maskFeather: { field: 'feather', label: 'Feather', min: 0, max: 400, step: 1, fallback: 0 },
  maskExpansion: { field: 'expansion', label: 'Expansion', min: -400, max: 400, step: 1, fallback: 0 },
  maskOpacity: { field: 'opacity', label: 'Mask opacity', min: 0, max: 1, step: 0.01, fallback: 1 }
} as const satisfies Record<string, Range>;

export type MaskKey = keyof typeof MASK_PROPS;
export const MASK_KEYS = Object.keys(MASK_PROPS) as MaskKey[];

export function isMaskKey(key: string): key is MaskKey {
  return key in MASK_PROPS;
}

const numeric = (key: MaskKey) => {
  const p = MASK_PROPS[key];
  return z.number().min(p.min).max(p.max).default(p.fallback);
};

const unit = z.number().min(0).max(1);
const DEFAULT_POINTS: [number, number][] = [
  [0.5, 0],
  [1, 0.38],
  [0.81, 1],
  [0.19, 1],
  [0, 0.38]
];

const NEEDS_MET: Record<Needs, (mask: { assetId: string | null; text: string }) => boolean> = {
  [Needs.Nothing]: () => true,
  [Needs.Points]: () => true,
  [Needs.Asset]: (m) => m.assetId !== null,
  [Needs.Text]: (m) => m.text.trim().length > 0
};

export const maskSchema = z
  .object({
    kind: z.enum(MASK_KIND_IDS),
    mode: z.enum(MASK_MODES).default(MaskMode.Add),
    x: numeric('maskX'),
    y: numeric('maskY'),
    width: numeric('maskWidth'),
    height: numeric('maskHeight'),
    rotation: numeric('maskRotation'),
    feather: numeric('maskFeather'),
    expansion: numeric('maskExpansion'),
    opacity: numeric('maskOpacity'),
    invert: z.boolean().default(false),
    points: z.array(z.tuple([unit, unit])).min(3).max(64).default(DEFAULT_POINTS),
    assetId: z.string().min(1).nullable().default(null),
    text: z.string().max(120).default('TEXT')
  })
  .refine((m) => NEEDS_MET[MASK_KINDS[m.kind].needs](m), { message: 'this mask kind needs an asset (image, luma) or text (text)' });

export const maskStackSchema = z.array(maskSchema).max(MAX_MASK_STACK);

export type Mask = z.output<typeof maskSchema>;
export type MaskInput = z.input<typeof maskSchema>;

export function maskValue(mask: Mask, key: MaskKey): number {
  return mask[MASK_PROPS[key].field];
}

export function newMask(kind: MaskKind, assetId: string | null = null): MaskInput {
  const box = MASK_KINDS[kind].box;
  return { kind, width: box, height: box, assetId };
}
