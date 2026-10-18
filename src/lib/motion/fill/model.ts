import { z } from 'zod';
import { BLEND_MODES, BlendMode } from '../blend';

export enum FillType {
  Solid = 'solid',
  Linear = 'linear-gradient',
  Radial = 'radial-gradient',
  Angular = 'angular-gradient',
  Diamond = 'diamond-gradient',
  Image = 'image'
}

export enum PaintedAs {
  Svg = 'svg',
  Html = 'html'
}

export const PAINTED_AS: Record<FillType, PaintedAs> = {
  [FillType.Solid]: PaintedAs.Svg,
  [FillType.Linear]: PaintedAs.Svg,
  [FillType.Radial]: PaintedAs.Svg,
  [FillType.Angular]: PaintedAs.Html,
  [FillType.Diamond]: PaintedAs.Html,
  [FillType.Image]: PaintedAs.Html
};

export enum ImageFit {
  Cover = 'cover',
  Contain = 'contain',
  Fill = 'fill',
  Tile = 'tile'
}

export const FILL_TYPES = Object.values(FillType) as [FillType, ...FillType[]];
export const FILL_LABEL: Record<FillType, string> = {
  [FillType.Solid]: 'Solid',
  [FillType.Linear]: 'Linear',
  [FillType.Radial]: 'Radial',
  [FillType.Angular]: 'Angular',
  [FillType.Diamond]: 'Diamond',
  [FillType.Image]: 'Image'
};
export const IMAGE_FITS = Object.values(ImageFit) as [ImageFit, ...ImageFit[]];
export const MAX_FILLS = 8;
export const MAX_STOPS = 8;
const CENTRE = 0.5;
const DEFAULT_COLOR = '#000000';
const DEFAULT_END = '#ffffff';
const DEFAULT_ANGLE = 90;

const unit = z.number().min(0).max(1);
const point = z.object({ x: unit.default(CENTRE), y: unit.default(CENTRE) });
const stop = z.object({ color: z.string().min(1).max(64), pos: unit });
const stops = z.array(stop).min(2).max(MAX_STOPS);

const base = {
  opacity: unit.default(1),
  visible: z.boolean().default(true),
  blend: z.enum(BLEND_MODES).default(BlendMode.Normal)
};

export const fillSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(FillType.Solid),
    color: z.string().min(1).max(64),
    ...base
  }),
  z.object({
    type: z.literal(FillType.Linear),
    stops,
    angle: z.number().min(-360).max(360).default(DEFAULT_ANGLE),
    ...base
  }),
  z.object({
    type: z.literal(FillType.Radial),
    stops,
    center: point.default({ x: CENTRE, y: CENTRE }),
    radius: z.number().min(0.01).max(4).default(1),
    ...base
  }),
  z.object({
    type: z.literal(FillType.Angular),
    stops,
    angle: z.number().min(-360).max(360).default(0),
    center: point.default({ x: CENTRE, y: CENTRE }),
    ...base
  }),
  z.object({
    type: z.literal(FillType.Diamond),
    stops,
    ...base
  }),
  z.object({
    type: z.literal(FillType.Image),
    assetId: z.string().max(200).default(''),
    src: z.string().max(4000).optional(),
    fit: z.enum(IMAGE_FITS).default(ImageFit.Cover),
    focus: point.default({ x: CENTRE, y: CENTRE }),
    scale: z.number().min(0.1).max(10).default(1),
    ...base
  })
]);

export const fillsSchema = z.array(fillSchema).max(MAX_FILLS);

export type Fill = z.infer<typeof fillSchema>;
export type FillOf<T extends FillType> = Extract<Fill, { type: T }>;
export type Stop = z.infer<typeof stop>;

const parsed = (raw: unknown): Fill[] => fillsSchema.parse(raw);

type LegacyShape = {
  fills?: unknown;
  fillKind?: unknown;
  fill?: unknown;
  fill2?: unknown;
  gradientAngle?: unknown;
};

const twoStops = (p: LegacyShape) => [
  { color: String(p.fill ?? DEFAULT_COLOR), pos: 0 },
  { color: String(p.fill2 ?? DEFAULT_END), pos: 1 }
];

const LEGACY: Record<string, (p: LegacyShape) => unknown[]> = {
  solid: (p) => [{ type: FillType.Solid, color: String(p.fill ?? DEFAULT_COLOR) }],
  linear: (p) => [
    {
      type: FillType.Linear,
      stops: twoStops(p),
      angle: Number(p.gradientAngle ?? DEFAULT_ANGLE)
    }
  ],
  radial: (p) => [{ type: FillType.Radial, stops: twoStops(p) }],
  none: () => []
};

export function fillsOf(props: LegacyShape): Fill[] {
  const stored = fillsSchema.safeParse(props.fills);
  if (props.fills !== undefined && stored.success) {
    return stored.data;
  }
  return parsed((LEGACY[String(props.fillKind ?? 'solid')] ?? LEGACY.solid)(props));
}

type LegacyPhoto = {
  assetId?: string;
  kind?: string;
  fit?: string;
  focusX?: number;
  focusY?: number;
  fills?: unknown;
};

export function photoFills(item: LegacyPhoto): Fill[] {
  const stored = fillsSchema.safeParse(item.fills);
  if (item.fills !== undefined && stored.success) {
    return stored.data;
  }
  if (!item.assetId) {
    return [];
  }
  return parsed([
    {
      type: FillType.Image,
      assetId: item.assetId,
      fit: item.fit,
      focus: { x: item.focusX ?? CENTRE, y: item.focusY ?? CENTRE }
    }
  ]);
}

export const firstImage = (fills: readonly Fill[]): FillOf<FillType.Image> | undefined => fills.find((f): f is FillOf<FillType.Image> => f.type === FillType.Image);

const colorOf = (fill: Fill | undefined): string => {
  if (!fill) {
    return DEFAULT_COLOR;
  }
  if (fill.type === FillType.Solid) {
    return fill.color;
  }
  return fill.type === FillType.Image ? DEFAULT_COLOR : fill.stops[0].color;
};

const freshStops = (color: string) => [
  { color, pos: 0 },
  { color: DEFAULT_END, pos: 1 }
];

const FRESH: Record<FillType, (color: string) => unknown> = {
  [FillType.Solid]: (color) => ({ type: FillType.Solid, color }),
  [FillType.Linear]: (color) => ({ type: FillType.Linear, stops: freshStops(color) }),
  [FillType.Radial]: (color) => ({ type: FillType.Radial, stops: freshStops(color) }),
  [FillType.Angular]: (color) => ({ type: FillType.Angular, stops: freshStops(color) }),
  [FillType.Diamond]: (color) => ({ type: FillType.Diamond, stops: freshStops(color) }),
  [FillType.Image]: () => ({ type: FillType.Image })
};

export const newFill = (type: FillType, color = DEFAULT_COLOR): Fill => fillSchema.parse(FRESH[type](color));

export const addFill = (fills: readonly Fill[], type: FillType): Fill[] => [...fills, newFill(type)].slice(0, MAX_FILLS);

export const removeFill = (fills: readonly Fill[], i: number): Fill[] => fills.filter((_, at) => at !== i);

export function moveFill(fills: readonly Fill[], from: number, to: number): Fill[] {
  const target = Math.max(0, Math.min(fills.length - 1, to));
  const next = fills.filter((_, at) => at !== from);
  next.splice(target, 0, fills[from]);
  return next;
}

export type FillPatch = Partial<Record<string, unknown>>;

export function setFill(fills: readonly Fill[], i: number, patch: FillPatch): Fill[] {
  const opacity = typeof patch.opacity === 'number' ? { opacity: Math.max(0, Math.min(1, patch.opacity)) } : {};
  return fills.map((f, at) => (at === i ? fillSchema.parse({ ...f, ...patch, ...opacity, type: f.type }) : f));
}

const HEX_ALPHA = /^(#[0-9a-f]{6})([0-9a-f]{2})$/i;
const HEX6 = /^#[0-9a-f]{6}$/i;
const BYTE = 255;
const ALPHA_DIGITS = 1000;

export function colourAlpha(colour: string): { base: string; alpha: number } {
  const split = HEX_ALPHA.exec(colour);
  return split ? { base: split[1], alpha: Math.round((parseInt(split[2], 16) / BYTE) * ALPHA_DIGITS) / ALPHA_DIGITS } : { base: colour, alpha: 1 };
}

export function withAlpha(colour: string, alpha: number, resolve: (c: string) => string): string {
  const { base } = colourAlpha(colour);
  if (alpha >= 1) {
    return base;
  }
  const hex = HEX6.test(base) ? base : resolve(base);
  return HEX6.test(hex) ? hex + Math.round(Math.max(0, alpha) * BYTE).toString(16).padStart(2, '0') : base;
}

const MIN_STOPS = 2;

export function addStop(stops: readonly Stop[], pos: number): Stop[] {
  const before = [...stops].filter((s) => s.pos <= pos).sort((a, b) => b.pos - a.pos)[0] ?? stops[0];
  return [...stops, { color: before.color, pos }].slice(0, MAX_STOPS);
}

export const removeStop = (stops: readonly Stop[], i: number): Stop[] => (stops.length > MIN_STOPS ? stops.filter((_, at) => at !== i) : [...stops]);

export function retypeFill(fills: readonly Fill[], i: number, type: FillType): Fill[] {
  return fills.map((f, at) =>
    at === i
      ? {
          ...newFill(type, colorOf(f)),
          opacity: f.opacity,
          visible: f.visible,
          blend: f.blend
        }
      : f
  );
}
