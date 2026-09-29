import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { jev, jevUsd } from './jev';
import { IDENTIFIABILITY_CATEGORIES, IDENTIFIABILITY_JUDGE_SYSTEM, judgeSystem, parseJudgeVerdict, type ModerationCategories } from './policy';
import { JudgeTier, MODERATION_PROFILES, profileOf } from './profiles';
import type { RecommendationTier } from '$lib/canvas/recommended-models';
import type { ModerationRecord, ScreenPorts } from './screen';

const JEV_LABEL = 'moderation.jev';
const IDENTIFIABILITY_JEV_LABEL = 'moderation.jev.identifiability';
const JUDGE_LABEL = 'moderation.judge';
const IDENTIFIABILITY_JUDGE_LABEL = 'moderation.judge.identifiability';
const JEV_NOT_CONFIGURED = 'jev_not_configured';

export type ModerationScope = {
  orgId: string;
  projectId: string | null;
  nodeId: string | null;
  userId: string;
  actor?: Actor;
  model: string | null;
  uncensored: boolean;
};

export function recordModeration(db: Db, scope: ModerationScope, entry: ModerationRecord): void {
  void (db as unknown as SupabaseClient)
    .from('moderation_checks')
    .insert({
      org_id: scope.orgId,
      node_id: scope.nodeId,
      model: scope.model,
      uncensored: scope.uncensored,
      stage: entry.stage,
      verdict: entry.verdict,
      category: entry.category,
      probabilities: entry.probabilities,
      reason: entry.reason,
      actor_kind: scope.actor?.kind ?? 'user',
      actor_id: scope.actor?.id ?? scope.userId
    })
    .then(({ error }) => {
      if (error) {
        console.error('[moderation] record failed:', error.message);
      }
    });
}

function callerOf(scope: ModerationScope) {
  return {
    orgId: scope.orgId,
    projectId: scope.projectId,
    userId: scope.userId,
    actorKind: scope.actor?.kind ?? ('user' as const),
    actorId: scope.actor?.id ?? scope.userId,
    agentKey: scope.actor?.agentKey ?? null,
    uncensored: scope.uncensored
  };
}

const CATALOGUE_TIER_OF_JUDGE: Readonly<Record<JudgeTier, RecommendationTier>> = {
  [JudgeTier.Cheapest]: 'cheapest-good',
  [JudgeTier.Best]: 'best'
};

async function judgeModel(tier: JudgeTier): Promise<string | undefined> {
  const { canvasModelCatalogue } = await import('$lib/server/canvas-catalogue');
  const catalogue = await canvasModelCatalogue().catch(() => null);
  return catalogue?.text.recommended.find((r) => r.tier === CATALOGUE_TIER_OF_JUDGE[tier])?.id;
}

async function decideWith(scope: ModerationScope, label: string, categories: ModerationCategories, state: string) {
  const apiKey = env.JEV_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(JEV_NOT_CONFIGURED);
  }
  const { logAiCall } = await import('$lib/server/ai-log');
  const startedAt = Date.now();
  try {
    const decision = await jev({ apiKey, baseUrl: env.JEV_BASE_URL?.trim() || undefined, categories }).decide(state);
    logAiCall({ label, provider: 'jev', model: 'jev-latest', ms: Date.now() - startedAt, ok: true, flatCostUsd: jevUsd(decision.tokens), ...callerOf(scope) });
    return decision;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'jev_failed';
    logAiCall({ label, provider: 'jev', model: 'jev-latest', ms: Date.now() - startedAt, ok: false, error: message, ...callerOf(scope) });
    throw error;
  }
}

async function judgeWith(scope: ModerationScope, label: string, system: string, state: string) {
  const [{ llmText }, { withOrgContext }] = await Promise.all([import('$lib/server/llm'), import('$lib/server/ai-log')]);
  const model = await judgeModel(MODERATION_PROFILES[profileOf(scope)].judgeTier);
  const { text } = await withOrgContext(scope.orgId, () => llmText({ prompt: state, system, model, label }));
  return parseJudgeVerdict(text);
}

export function moderationPorts(db: Db, scope: ModerationScope): ScreenPorts {
  const { categories } = MODERATION_PROFILES[profileOf(scope)];
  return {
    decide: (state) => decideWith(scope, JEV_LABEL, categories, state),
    decideIdentifiability: (state) => decideWith(scope, IDENTIFIABILITY_JEV_LABEL, IDENTIFIABILITY_CATEGORIES, state),
    judge: (state) => judgeWith(scope, JUDGE_LABEL, judgeSystem(categories), state),
    judgeIdentifiability: (state) => judgeWith(scope, IDENTIFIABILITY_JUDGE_LABEL, IDENTIFIABILITY_JUDGE_SYSTEM, state),
    record: (entry) => recordModeration(db, scope, entry)
  };
}
