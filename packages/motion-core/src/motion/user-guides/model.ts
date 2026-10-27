import { z } from 'zod';

export enum GuideAxis {
  Vertical = 'x',
  Horizontal = 'y'
}

export const MAX_USER_GUIDES = 64;
const MAX_POSITION = 16384;

export const userGuideSchema = z.object({
  axis: z.enum([GuideAxis.Vertical, GuideAxis.Horizontal]),
  at: z.number().min(0).max(MAX_POSITION)
});

export const userGuidesSchema = z.array(userGuideSchema).max(MAX_USER_GUIDES).optional();

export type UserGuide = z.infer<typeof userGuideSchema>;
