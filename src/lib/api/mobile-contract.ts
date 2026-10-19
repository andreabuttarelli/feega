import { z } from 'zod';

export const ProjectSummary = z.object({ id: z.string(), name: z.string(), lastActiveAt: z.string() });

export const ProjectList = z.object({
  org: z.object({ id: z.string(), name: z.string() }),
  projects: z.array(ProjectSummary)
});

export const CanvasSummary = z.object({ id: z.string(), name: z.string(), path: z.string() });

export const CanvasList = z.object({
  project: z.object({ id: z.string(), name: z.string() }),
  canvases: z.array(CanvasSummary)
});

export const ApiError = z.object({ error: z.string() });

export const MOBILE_CONTRACT = { ProjectList, CanvasList, ApiError };

export type ProjectList = z.infer<typeof ProjectList>;
export type CanvasList = z.infer<typeof CanvasList>;

export function contractSchema(): Record<string, unknown> {
  const defs = Object.fromEntries(Object.entries(MOBILE_CONTRACT).map(([name, schema]) => [name, z.toJSONSchema(schema)]));
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'feega mobile API contract', $defs: defs };
}
