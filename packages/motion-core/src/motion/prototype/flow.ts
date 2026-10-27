import { z } from 'zod';

export const MAX_FLOW_NAME = 60;

export const flowSchema = z.object({ name: z.string().min(1).max(MAX_FLOW_NAME) });

export type Flow = z.infer<typeof flowSchema>;
