import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { jev, jevUsd } from './jev';
import { JUDGE_SYSTEM, parseJudgeVerdict } from './policy';
import type { ModerationRecord, ScreenPorts } from './screen';

const JEV_LABEL = 'moderation.jev';
const JUDGE_LABEL = 'moderation.judge';
const JEV_NOT_CONFIGURED = 'jev_not_configured';
const BEST_TIER = 'best';

export type ModerationScope = {
  orgId: string;
  projectId: string;
  nodeId: string;
  userId: string;
  actor?: Actor;
  model: string;
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

async function judgeModel(): Promise<string | undefined> {
  const { canvasModelCatalogue } = await import('$lib/server/canvas-catalogue');
  const catalogue = await canvasModelCatalogue().catch(() => null);
  return catalogue?.text.recommended.find((r) => r.tier === BEST_TIER)?.id;
}

export function moderationPorts(db: Db, scope: ModerationScope): ScreenPorts {
  return {
    async decide(state) {
      const apiKey = env.JEV_API_KEY?.trim();
      if (!apiKey) {
        throw new Error(JEV_NOT_CONFIGURED);
      }
      const { logAiCall } = await import('$lib/server/ai-log');
      const startedAt = Date.now();
      try {
        const decision = await jev({ apiKey, baseUrl: env.JEV_BASE_URL?.trim() || undefined }).decide(state);
        logAiCall({ label: JEV_LABEL, provider: 'jev', model: 'jev-latest', ms: Date.now() - startedAt, ok: true, flatCostUsd: jevUsd(decision.tokens), ...callerOf(scope) });
        return decision;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'jev_failed';
        logAiCall({ label: JEV_LABEL, provider: 'jev', model: 'jev-latest', ms: Date.now() - startedAt, ok: false, error: message, ...callerOf(scope) });
        throw error;
      }
    },

    async judge(state) {
      const [{ llmText }, { withOrgContext }] = await Promise.all([import('$lib/server/llm'), import('$lib/server/ai-log')]);
      const model = await judgeModel();
      const { text } = await withOrgContext(scope.orgId, () => llmText({ prompt: state, system: JUDGE_SYSTEM, model, label: JUDGE_LABEL }));
      return parseJudgeVerdict(text);
    },

    record: (entry) => recordModeration(db, scope, entry)
  };
}
