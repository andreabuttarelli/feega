import { z } from 'zod';

export const versionMarkSchema = z.object({ of: z.string(), ref: z.string(), label: z.string(), sha: z.string(), entry: z.string() });

export type VersionMark = z.infer<typeof versionMarkSchema>;

export function versionMarkOf(data: Record<string, unknown> | null | undefined): VersionMark | null {
  const parsed = versionMarkSchema.safeParse(data?.version);
  return parsed.success ? parsed.data : null;
}
