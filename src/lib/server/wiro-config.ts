import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { wiro } from './wiro';
import { WIRO_PROVIDER } from './wiro-catalogue';
import { wireSpecOf } from './wiro-choice';
import type { WiroGateway } from './canvas/wiro-gateway';
import type { WiroBill, WiroCatalogue, WiroModel, WiroRunDeps, WiroScope } from './canvas/wiro-run';
import { WIRO_LABEL } from './canvas/wiro-run';
import { uncensoredAccess } from './uncensored-access';
import { moderationPorts, recordModeration } from './moderation/moderation-config';

export function configuredWiro(): WiroGateway | null {
  const apiKey = env.WIRO_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return wiro({ apiKey, apiSecret: env.WIRO_API_SECRET?.trim() || undefined, baseUrl: env.WIRO_BASE_URL?.trim() || undefined });
}

const WIRO_CATALOGUES: ReadonlySet<WiroCatalogue> = new Set(['image', 'video', 'model3d']);

type WiroModelRow = { id: string; catalogue: string; uncensored: boolean | null; wire_spec: unknown; param_schema: Record<string, unknown> | null };

async function wiroModel(modelId: string): Promise<WiroModel | null> {
  const { createAdminClient } = await import('./supabase-admin');
  const { data } = await (createAdminClient() as SupabaseClient)
    .from('ai_models')
    .select('id, catalogue, uncensored, wire_spec, param_schema')
    .eq('id', modelId)
    .eq('provider', WIRO_PROVIDER)
    .maybeSingle();
  const row = data as WiroModelRow | null;
  const spec = row ? wireSpecOf(row.wire_spec) : null;
  if (!row || !spec) {
    return null;
  }
  return {
    id: row.id,
    catalogue: WIRO_CATALOGUES.has(row.catalogue as WiroCatalogue) ? (row.catalogue as WiroCatalogue) : 'image',
    spec,
    uncensored: row.uncensored === true,
    paramSchema: row.param_schema ?? {}
  };
}

function bill(entry: WiroBill): void {
  void import('./ai-log').then(({ logAiCall }) =>
    logAiCall({
      label: WIRO_LABEL,
      provider: 'wiro',
      model: entry.model,
      ms: entry.ms,
      ok: !entry.error,
      error: entry.error,
      flatCostUsd: entry.costUsd ?? undefined,
      orgId: entry.scope.orgId,
      projectId: entry.scope.projectId,
      userId: entry.scope.userId,
      actorKind: entry.scope.actor?.kind ?? 'user',
      actorId: entry.scope.actor?.id ?? entry.scope.userId,
      agentKey: entry.scope.actor?.agentKey ?? null,
      uncensored: entry.uncensored
    })
  );
}

function moderationScope(scope: WiroScope, model: WiroModel) {
  return { ...scope, model: model.id, uncensored: model.uncensored };
}

export function wiroRunDeps(db: Db): WiroRunDeps {
  return {
    gateway: configuredWiro(),
    model: wiroModel,
    access: (orgId) => uncensoredAccess(db, orgId),
    screen: (scope, model) => moderationPorts(db, moderationScope(scope, model)),
    refuseLikeness: (scope, model, reason) =>
      recordModeration(db, moderationScope(scope, model), { stage: 'rules', verdict: 'refuse', category: 'real_person_sexual', probabilities: {}, reason }),
    bill
  };
}
