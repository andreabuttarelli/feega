import { z } from 'zod';

export const versionMarkSchema = z.object({ of: z.string(), ref: z.string(), label: z.string(), sha: z.string(), entry: z.string() });

export type VersionMark = z.infer<typeof versionMarkSchema>;

export function versionMarkOf(data: Record<string, unknown> | null | undefined): VersionMark | null {
  const parsed = versionMarkSchema.safeParse(data?.version);
  return parsed.success ? parsed.data : null;
}

const PAIR = 2;

export function comparedWith(versionId: string, originalId: string, selected: readonly string[]): string {
  const other = selected.length === PAIR && selected.includes(versionId) ? selected.find((id) => id !== versionId) : undefined;
  return other ?? originalId;
}
