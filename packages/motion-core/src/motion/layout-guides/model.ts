import { z } from 'zod';

export enum GuideKind {
  Columns = 'columns',
  Rows = 'rows',
  Grid = 'grid'
}

export enum GuideAlign {
  Stretch = 'stretch',
  Min = 'min',
  Max = 'max',
  Center = 'center'
}

export const AUTO_COUNT = 'auto';
export const MAX_LAYOUT_GUIDES = 8;
export const DEFAULT_GUIDE_SIZE = 8;
export const DEFAULT_AUTO_SIZE = 80;
export const DEFAULT_GUIDE_COLOR = '#ff0000';
export const DEFAULT_GUIDE_OPACITY = 0.1;
const MAX_BANDS = 48;
const MAX_PX = 4096;

const ALIGNS = Object.values(GuideAlign) as [GuideAlign, ...GuideAlign[]];

export const layoutGuideSchema = z.object({
  kind: z.enum([GuideKind.Columns, GuideKind.Rows, GuideKind.Grid]),
  count: z.union([z.literal(AUTO_COUNT), z.number().int().min(1).max(MAX_BANDS)]).default(12),
  gutter: z.number().min(0).max(MAX_PX).default(20),
  margin: z.number().min(0).max(MAX_PX).default(0),
  size: z.number().min(1).max(MAX_PX).default(DEFAULT_GUIDE_SIZE),
  align: z.enum(ALIGNS).default(GuideAlign.Stretch),
  offset: z.number().min(0).max(MAX_PX).default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default(DEFAULT_GUIDE_COLOR),
  opacity: z.number().min(0).max(1).default(DEFAULT_GUIDE_OPACITY),
  hidden: z.boolean().optional()
});

export const layoutGuidesSchema = z.array(layoutGuideSchema).max(MAX_LAYOUT_GUIDES).optional();

export type LayoutGuide = z.infer<typeof layoutGuideSchema>;
