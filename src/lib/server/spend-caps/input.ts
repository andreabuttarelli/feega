import { z } from 'zod';
import { CapReset, CapScope } from './policy';

export const capInputSchema = z
  .object({
    scope: z.nativeEnum(CapScope),
    project_id: z.string().uuid().nullish(),
    cap_usd: z.number().positive().max(1_000_000).nullable(),
    reset: z.nativeEnum(CapReset).default(CapReset.None)
  })
  .refine((cap) => (cap.scope === CapScope.OrgMember) === !cap.project_id, { message: 'project_id is for project scopes only, and required there' });

export type CapInput = z.infer<typeof capInputSchema>;
