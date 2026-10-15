import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { wiro } from './wiro';
import { WIRO_PROVIDER } from './wiro-catalogue';
import { wireSpecOf } from './wiro-choice';
import type { TaskProvider } from './canvas/task-provider';
import type { TaskBill, TaskCatalogue, TaskModel, TaskRunDeps, TaskScope } from './canvas/task-run';
import { TASK_LABEL } from './canvas/task-run';
import { uncensoredAccess } from './uncensored-access';
import { moderationPorts, recordModeration } from './moderation/moderation-config';

export function configuredWiro(): TaskProvider | null {
  const apiKey = env.WIRO_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return wiro({ apiKey, apiSecret: env.WIRO_API_SECRET?.trim() || undefined, baseUrl: env.WIRO_BASE_URL?.trim() || undefined });
}

const WIRO_CATALOGUES: ReadonlySet<TaskCatalogue> = new Set(['image', 'video', 'model3d']);

type WiroModelRow = { id: string; catalogue: string; uncensored: boolean | null; wire_spec: unknown; param_schema: Record<string, unknown> | null };

async function wiroModel(modelId: string): Promise<TaskModel | null> {
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
    catalogue: WIRO_CATALOGUES.has(row.catalogue as TaskCatalogue) ? (row.catalogue as TaskCatalogue) : 'image',
    spec,
    uncensored: row.uncensored === true,
    paramSchema: row.param_schema ?? {}
  };
}

function bill(entry: TaskBill): void {
  void import('./ai-log').then(({ logAiCall }) =>
    logAiCall({
      label: TASK_LABEL,
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

function moderationScope(scope: TaskScope, model: TaskModel) {
  return { ...scope, model: model.id, uncensored: model.uncensored };
}

export function taskRunDeps(db: Db): TaskRunDeps {
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
