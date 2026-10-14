import { z } from 'zod';
import { FillType, fillSchema } from '../fill/model';
import { CAPS, JOINS, ShapeKind } from '../shape/schema';

export enum StrokeAlign {
  Inside = 'inside',
  Center = 'center',
  Outside = 'outside'
}

export const STROKE_ALIGNS = Object.values(StrokeAlign) as [StrokeAlign, ...StrokeAlign[]];
export const MAX_STROKES = 8;
export const MAX_STROKE_WIDTH = 0.2;
const MAX_DASH = 0.5;
const DEFAULT_WIDTH = 0.01;
const DEFAULT_COLOR = '#000000';
const DEFAULT_END = '#ffffff';
const DEFAULT_ANGLE = 90;

const width = z.number().min(0).max(MAX_STROKE_WIDTH);
const dashLength = z.number().min(0).max(MAX_DASH).default(0);

export const strokePaintSchema = fillSchema.refine((f) => f.type !== FillType.Image, { message: 'a stroke paints with a colour or a gradient, not an image' });

export const strokeSchema = z.object({
  paint: strokePaintSchema,
  width: width.default(DEFAULT_WIDTH),
  align: z.enum(STROKE_ALIGNS).default(StrokeAlign.Center),
  sides: z.tuple([width, width, width, width]).optional(),
  dash: dashLength,
  gap: dashLength,
  cap: z.enum(CAPS).default('butt'),
  join: z.enum(JOINS).default('miter'),
  visible: z.boolean().default(true)
});

export const strokesSchema = z.array(strokeSchema).max(MAX_STROKES);

export type Stroke = z.infer<typeof strokeSchema>;
export type StrokePatch = Partial<Record<string, unknown>>;

export const SIDED: Record<ShapeKind, boolean> = {
  [ShapeKind.Rect]: true,
  [ShapeKind.Line]: false,
  [ShapeKind.Circle]: false,
  [ShapeKind.Ellipse]: false,
  [ShapeKind.Polygon]: false,
  [ShapeKind.Star]: false,
  [ShapeKind.Path]: false
};

export const sidesShown = (kind: ShapeKind): boolean => SIDED[kind] ?? false;

type LegacyStroke = {
  strokes?: unknown;
  strokeKind?: unknown;
  stroke?: unknown;
  strokeWidth?: unknown;
  dash?: unknown;
  gap?: unknown;
  cap?: unknown;
  join?: unknown;
  fill?: unknown;
  fill2?: unknown;
  gradientAngle?: unknown;
};

const lineOf = (p: LegacyStroke) => ({ width: p.strokeWidth ?? DEFAULT_WIDTH, dash: p.dash ?? 0, gap: p.gap ?? 0, cap: p.cap ?? 'butt', join: p.join ?? 'miter' });

const LEGACY: Record<string, (p: LegacyStroke) => unknown[]> = {
  none: () => [],
  solid: (p) => [{ paint: { type: FillType.Solid, color: String(p.stroke ?? DEFAULT_COLOR) }, ...lineOf(p) }],
  gradient: (p) => [
    {
      paint: {
        type: FillType.Linear,
        angle: Number(p.gradientAngle ?? DEFAULT_ANGLE),
        stops: [
          { color: String(p.fill ?? DEFAULT_COLOR), pos: 0 },
          { color: String(p.fill2 ?? DEFAULT_END), pos: 1 }
        ]
      },
      ...lineOf(p)
    }
  ]
};

export function strokesOf(props: LegacyStroke): Stroke[] {
  const stored = strokesSchema.safeParse(props.strokes);
  if (props.strokes !== undefined && stored.success) {
    return stored.data;
  }
  return strokesSchema.parse((LEGACY[String(props.strokeKind ?? 'none')] ?? LEGACY.none)(props));
}

export const newStroke = (color = DEFAULT_COLOR): Stroke => strokeSchema.parse({ paint: { type: FillType.Solid, color } });

export const addStroke = (strokes: readonly Stroke[]): Stroke[] => [...strokes, newStroke()].slice(0, MAX_STROKES);

export const removeStroke = (strokes: readonly Stroke[], i: number): Stroke[] => strokes.filter((_, at) => at !== i);

export function moveStroke(strokes: readonly Stroke[], from: number, to: number): Stroke[] {
  const target = Math.max(0, Math.min(strokes.length - 1, to));
  const next = strokes.filter((_, at) => at !== from);
  next.splice(target, 0, strokes[from]);
  return next;
}

export const setStroke = (strokes: readonly Stroke[], i: number, patch: StrokePatch): Stroke[] => strokes.map((s, at) => (at === i ? strokeSchema.parse({ ...s, ...patch }) : s));
