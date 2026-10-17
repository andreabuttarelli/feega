import { z } from 'zod';
import { fillsSchema } from './fill/model';

export const MAX_PART_STYLES = 64;
const PART_ID_MAX = 80;

export const partStyleSchema = z.object({ fills: fillsSchema });

export const partStylesSchema = z
  .record(z.string().min(1).max(PART_ID_MAX), partStyleSchema)
  .refine((styles) => Object.keys(styles).length <= MAX_PART_STYLES, { message: `at most ${MAX_PART_STYLES} part styles` });

export type PartStyle = z.infer<typeof partStyleSchema>;
export type PartStyles = z.infer<typeof partStylesSchema>;
