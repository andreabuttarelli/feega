import { z } from 'zod';

export enum GuideKind {
  Columns = 'columns',
  Rows = 'rows',
  Grid = 'grid'
}

export const MAX_LAYOUT_GUIDES = 8;
const MAX_BANDS = 48;
const MAX_PX = 4096;

export const layoutGuideSchema = z.object({
  kind: z.enum([GuideKind.Columns, GuideKind.Rows, GuideKind.Grid]),
  count: z.number().int().min(1).max(MAX_BANDS).default(12),
  gutter: z.number().min(0).max(MAX_PX).default(20),
  margin: z.number().min(0).max(MAX_PX).default(0),
  size: z.number().min(1).max(MAX_PX).default(8),
  hidden: z.boolean().optional()
});

export const layoutGuidesSchema = z.array(layoutGuideSchema).max(MAX_LAYOUT_GUIDES).optional();

export type LayoutGuide = z.infer<typeof layoutGuideSchema>;
