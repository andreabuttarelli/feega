import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { billedCreditsFor } from '$lib/credit-ladder';
import { wiro } from './wiro';
import { kie } from './kie';
import { higgsfield, higgsfieldConfig } from './higgsfield';
import { wireSpecOf } from './task-choice';
import type { TaskProvider } from './canvas/task-provider';
import type { ProviderLoad, TaskBill, TaskCatalogue, TaskModel, TaskRunDeps, TaskScope } from './canvas/task-run';
import { taskLabelOf } from './canvas/task-run';
import { configuredIn, jobPrefixOf, TASK_PROVIDERS, taskProviderOf, TaskProviderName, waitingJobOf } from './generation/task-providers';
import { createServiceRoleDb } from './db/client';
import { SERVICE_ROLE_USES } from './db/service-role-uses';
import { providerLoad } from './repos/node-runs';
import { uncensoredAccess } from './uncensored-access';
import { moderationPorts, recordModeration } from './moderation/moderation-config';

type Env = Readonly<Record<string, string | undefined>>;

const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined;

const ADAPTERS: Readonly<Record<TaskProviderName, (env: Env) => TaskProvider>> = {
  [TaskProviderName.Wiro]: (e) => wiro({ apiKey: e.WIRO_API_KEY!.trim(), apiSecret: trimmed(e.WIRO_API_SECRET), baseUrl: trimmed(e.WIRO_BASE_URL) }),
  [TaskProviderName.Kie]: (e) => kie({ apiKey: e.KIE_API_KEY!.trim(), baseUrl: trimmed(e.KIE_BASE_URL) }),
  [TaskProviderName.Higgsfield]: (e) => higgsfield(higgsfieldConfig(e)!)
};


export function configuredTaskProviders(source: Env = env): Partial<Record<TaskProviderName, TaskProvider>> {
  return Object.fromEntries([...configuredIn(source)].map((provider) => [provider, ADAPTERS[provider](source)]));
}

export function configuredWiro(): TaskProvider | null {
  return configuredTaskProviders()[TaskProviderName.Wiro] ?? null;
}

const TASK_CATALOGUES: ReadonlySet<TaskCatalogue> = new Set(['image', 'video', 'model3d']);

type TaskModelRow = {
  id: string;
  catalogue: string;
  uncensored: boolean | null;
  wire_spec: unknown;
  param_schema: Record<string, unknown> | null;
  pricing: unknown;
};

async function taskModel(modelId: string): Promise<TaskModel | null> {
  const provider = taskProviderOf(modelId);
  if (!provider) {
    return null;
  }
  const { createAdminClient } = await import('./supabase-admin');
  const { data } = await (createAdminClient() as SupabaseClient)
    .from('ai_models')
    .select('id, catalogue, uncensored, wire_spec, param_schema, pricing')
    .eq('id', modelId)
    .eq('provider', provider)
    .maybeSingle();
  const row = data as TaskModelRow | null;
  const spec = row ? wireSpecOf(row.wire_spec) : null;
  if (!row || !spec) {
    return null;
  }
  return {
    id: row.id,
    catalogue: TASK_CATALOGUES.has(row.catalogue as TaskCatalogue) ? (row.catalogue as TaskCatalogue) : 'image',
    spec,
    uncensored: row.uncensored === true,
    paramSchema: row.param_schema ?? {},
    pricing: row.pricing
  };
}

function bill(entry: TaskBill): void {
  void import('./ai-log').then(({ logAiCall }) =>
    logAiCall({
      label: taskLabelOf(entry.provider),
      provider: entry.provider,
      model: entry.model,
      ms: entry.ms,
      ok: !entry.error,
      error: entry.error,
      flatCostUsd: entry.costUsd ?? undefined,
      creditCap: entry.quotedUsd ? billedCreditsFor(entry.quotedUsd) : undefined,
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

export function concurrencyCapOf(provider: TaskProviderName, source: Env): number | null {
  const limit = TASK_PROVIDERS[provider].maxInFlight;
  if (!limit) {
    return null;
  }
  const configured = Number(source[limit.envKey]);
  return Number.isInteger(configured) && configured > 0 ? configured : limit.fallback;
}

const LOAD_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/task-providers-config.ts'));

async function loadOf(provider: TaskProviderName): Promise<ProviderLoad> {
  const cap = concurrencyCapOf(provider, env);
  if (cap === null) {
    return { inFlight: 0, waiting: 0, cap: null };
  }
  if (!LOAD_USE) {
    throw new Error('loadOf: missing entry in service-role-uses.ts');
  }
  const counted = await providerLoad(createServiceRoleDb(LOAD_USE), { prefix: jobPrefixOf(provider), waitingJobId: waitingJobOf(provider) });
  return { ...counted, cap };
}

function moderationScope(scope: TaskScope, model: TaskModel) {
  return { ...scope, model: model.id, uncensored: model.uncensored };
}

export function taskRunDeps(db: Db): TaskRunDeps {
  return {
    providers: configuredTaskProviders(),
    load: loadOf,
    model: taskModel,
    access: (orgId) => uncensoredAccess(db, orgId),
    screen: (scope, model) => moderationPorts(db, moderationScope(scope, model)),
    refuseLikeness: (scope, model, reason) =>
      recordModeration(db, moderationScope(scope, model), { stage: 'rules', verdict: 'refuse', category: 'real_person_sexual', probabilities: {}, reason }),
    bill
  };
}
