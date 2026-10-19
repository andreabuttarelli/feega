import { z } from 'zod';

export const ProjectList = z.object({
  org: z.object({ id: z.string(), name: z.string() }),
  projects: z.array(z.object({ id: z.string(), name: z.string(), lastActiveAt: z.string() }))
});

export const CanvasList = z.object({
  project: z.object({ id: z.string(), name: z.string() }),
  canvases: z.array(z.object({ id: z.string(), name: z.string(), path: z.string() }))
});

export type ProjectList = z.infer<typeof ProjectList>;
export type CanvasList = z.infer<typeof CanvasList>;
