import type { Db } from '$lib/server/db/client';
import { configuredIn, TaskProviderName } from '$lib/server/generation/task-providers';
import { syncAiModels, type SyncOutcome } from '$lib/server/ai-models-sync';
import { DEFAULT_LLM_BASE_URL } from '$lib/server/llm';

type Env = Record<string, string | undefined>;
type Sync = (db: never, opts: { baseUrl: string }) => Promise<SyncOutcome>;

const OPENROUTER = 'openrouter';

const hasOpenRouterKey = (env: Env) => Boolean(env.OPENROUTER_API_KEY?.trim() || env.LLM_API_KEY?.trim());

function unkeyedProviders(env: Env): string[] {
  const configured = configuredIn(env);
  const task = Object.values(TaskProviderName).filter((provider) => !configured.has(provider));
  return hasOpenRouterKey(env) ? task : [...task, OPENROUTER];
}

export async function syncLocalModels(db: Db, env: Env, sync: Sync = syncAiModels as Sync): Promise<SyncOutcome> {
  const outcome = await sync(db as never, { baseUrl: env.LLM_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL });
  await db.from('ai_models').delete().in('provider', unkeyedProviders(env));
  return outcome;
}
