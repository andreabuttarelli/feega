import { z } from 'zod';
import { Align, AutoFlow, DEFAULT_COLUMNS, Direction, Justify, Sizing, TrackType } from './auto-layout';

export const MAX_LAYOUT_PX = 4000;
export const MAX_LAYOUT_CHILDREN = 200;
export const MAX_GRID_COLUMNS = 24;
export const MAX_GRID_ROWS = 100;

const DIRECTIONS = Object.values(Direction) as [Direction, ...Direction[]];
const JUSTIFIES = Object.values(Justify) as [Justify, ...Justify[]];
const ALIGNS = Object.values(Align) as [Align, ...Align[]];
const TRACK_TYPES = Object.values(TrackType) as [TrackType, ...TrackType[]];
const AUTO_FLOWS = Object.values(AutoFlow) as [AutoFlow, ...AutoFlow[]];
export const SIZINGS = Object.values(Sizing) as [Sizing, ...Sizing[]];

const px = z.number().min(0).max(MAX_LAYOUT_PX);
const signedPx = z.number().min(-MAX_LAYOUT_PX).max(MAX_LAYOUT_PX);

export const trackSchema = z.object({ type: z.enum(TRACK_TYPES), value: px.default(1) });

const span = z.number().int().min(1).max(MAX_GRID_ROWS);
const index = z.number().int().min(0).max(MAX_GRID_ROWS - 1);

export const paddingSchema = z.object({ top: px.default(0), right: px.default(0), bottom: px.default(0), left: px.default(0) });

export const autoLayoutSchema = z.object({
  direction: z.enum(DIRECTIONS).default(Direction.Horizontal),
  wrap: z.boolean().default(false),
  gap: signedPx.default(0),
  crossGap: signedPx.default(0),
  padding: paddingSchema.default({ top: 0, right: 0, bottom: 0, left: 0 }),
  justify: z.enum(JUSTIFIES).default(Justify.Start),
  align: z.enum(ALIGNS).default(Align.Start),
  columns: z.number().int().min(1).max(MAX_GRID_COLUMNS).default(DEFAULT_COLUMNS),
  columnTracks: z.array(trackSchema).max(MAX_GRID_COLUMNS).default([]),
  rowTracks: z.array(trackSchema).max(MAX_GRID_ROWS).default([]),
  autoFlow: z.enum(AUTO_FLOWS).default(AutoFlow.Row),
  order: z.array(z.string().min(1)).max(MAX_LAYOUT_CHILDREN).default([])
});

export const layoutItemSchema = z.object({
  width: z.enum(SIZINGS).default(Sizing.Fixed),
  height: z.enum(SIZINGS).default(Sizing.Fixed),
  minWidth: px.optional(),
  maxWidth: px.optional(),
  minHeight: px.optional(),
  maxHeight: px.optional(),
  absolute: z.boolean().default(false),
  column: index.optional(),
  row: index.optional(),
  columnSpan: span.default(1),
  rowSpan: span.default(1),
  cellX: z.enum(ALIGNS).optional(),
  cellY: z.enum(ALIGNS).optional()
});

type Defaulted = { unwrap: () => z.ZodType };

const withoutDefaults = <T extends z.ZodRawShape>(shape: T) =>
  z.object(Object.fromEntries(Object.entries(shape).map(([key, field]) => [key, (('unwrap' in field ? (field as unknown as Defaulted).unwrap() : field) as z.ZodType).optional()]))) as unknown as z.ZodObject<{ [K in keyof T]: z.ZodOptional<z.ZodType<z.output<T[K]>>> }>;

export const autoLayoutPatchSchema = withoutDefaults(autoLayoutSchema.shape);
export const layoutItemPatchSchema = withoutDefaults(layoutItemSchema.shape);

export type Padding = z.infer<typeof paddingSchema>;
export type AutoLayout = z.infer<typeof autoLayoutSchema>;
export type LayoutItem = z.infer<typeof layoutItemSchema>;

export const DEFAULT_AUTO_LAYOUT: AutoLayout = autoLayoutSchema.parse({});
export const DEFAULT_LAYOUT_ITEM: LayoutItem = layoutItemSchema.parse({});

const TRACKS_OF_AXIS = { width: 'columnTracks', height: 'rowTracks' } as const;

export function flexOnHug(layout: AutoLayout | null | undefined, item: LayoutItem | null | undefined): string | null {
  if (layout?.direction !== Direction.Grid) {
    return null;
  }
  const sizing = item ?? DEFAULT_LAYOUT_ITEM;
  for (const axis of ['width', 'height'] as const) {
    const flexed = layout[TRACKS_OF_AXIS[axis]].some((t) => t.type === TrackType.Flex);
    if (flexed && sizing[axis] === Sizing.Hug) {
      return `a flex track is not valid when the grid hugs its ${axis}: use fixed or hug tracks, or a fixed ${axis}`;
    }
  }
  return null;
}
