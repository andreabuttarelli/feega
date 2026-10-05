import { z } from 'zod';

export const LUT_NODES = 17;
const AFFINE = 12;
const MAX_NAME = 80;

const unit = z.number().min(0).max(1);
const curve = z.array(unit).length(LUT_NODES);

export const lutSchema = z.object({
  name: z.string().max(MAX_NAME),
  matrix: z.array(z.number().min(-8).max(8)).length(AFFINE),
  curves: z.tuple([curve, curve, curve])
});

export type CompiledLut = z.infer<typeof lutSchema>;
