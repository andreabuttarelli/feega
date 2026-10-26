import type { ModelChoice } from '$lib/canvas/gen-node';

export type AllowlistMedium = 'image' | 'video' | 'model3d';

const ALLOWLIST_MEDIA: ReadonlySet<string> = new Set<AllowlistMedium>(['image', 'video', 'model3d']);

type AllowlistReader = {
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => PromiseLike<{ data: unknown[] | null; error: unknown }> } };
  };
};

export async function allowedIds(db: unknown, orgId: string, medium: AllowlistMedium): Promise<Set<string> | null> {
  const { data, error } = await (db as AllowlistReader).from('org_model_allowlist').select('model_id').eq('org_id', orgId).eq('medium', medium);
  if (error || !data?.length) {
    return null;
  }
  return new Set(data.map((row) => (row as { model_id: string }).model_id));
}

export function applyAllowlist(choices: ModelChoice[], allowed: Set<string> | null): ModelChoice[] {
  return allowed ? choices.filter((choice) => allowed.has(choice.id)) : choices;
}

export const MODEL_NOT_ALLOWED = 'This model is not enabled for your organization.';

export async function allowlistRefusal(db: unknown, scope: { orgId: string; medium: string; model: string | null }): Promise<string | null> {
  if (!scope.model || !ALLOWLIST_MEDIA.has(scope.medium)) {
    return null;
  }
  const allowed = await allowedIds(db, scope.orgId, scope.medium as AllowlistMedium);
  return !allowed || allowed.has(scope.model) ? null : MODEL_NOT_ALLOWED;
}

export async function allowedCatalogue<M extends { choices: ModelChoice[] }>(db: unknown, orgId: string, catalogue: Record<string, M>): Promise<Record<string, M>> {
  const entries = await Promise.all(
    Object.entries(catalogue).map(async ([medium, entry]) => {
      if (!ALLOWLIST_MEDIA.has(medium)) {
        return [medium, entry] as const;
      }
      const allowed = await allowedIds(db, orgId, medium as AllowlistMedium);
      return [medium, { ...entry, choices: applyAllowlist(entry.choices, allowed) }] as const;
    })
  );
  return Object.fromEntries(entries);
}
