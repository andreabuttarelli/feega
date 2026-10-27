import { z } from 'zod';

const fraction = z.number().min(0).max(1);

const strokeSchema = z.object({ points: z.array(z.tuple([fraction, fraction])).min(1).max(2000), width: z.number().positive().max(1) });

const regionSchema = z.object({ left: fraction, top: fraction, width: z.number().positive().max(1), height: z.number().positive().max(1) });

const MAX_MARKS = 200;

export const maskSchema = z
  .object({ strokes: z.array(strokeSchema).max(MAX_MARKS).optional(), regions: z.array(regionSchema).max(MAX_MARKS).optional() })
  .refine((mask) => (mask.strokes?.length ?? 0) + (mask.regions?.length ?? 0) > 0, 'draw at least one stroke or region');

export type Mask = z.infer<typeof maskSchema>;

export type Stroke = z.infer<typeof strokeSchema>;

export type Region = z.infer<typeof regionSchema>;
