import type { Db } from '$lib/server/db/client';
import type { DeepView } from '$lib/motion/deep';
import { orgCreditBalance } from '$lib/server/credits';
import { openNodeThread, saveTurn } from '$lib/server/repos/chat';
import { createDeepRun, DEEP_KIND, latestDeep } from '$lib/server/repos/deep-runs';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { runInBackground } from '$lib/server/background-work';
import type { Actor } from '$lib/server/repos/actor';
import { ensureGatewayModels, gatewayRate } from '$lib/server/openrouter-models';
import { deepQuote } from './budget';
import { deepView, runDeepJob } from './job';
import { freshState } from './loop';
import { DEEP_MAX_DURATION_S } from './limits';

export enum DeepRefusal {
  Credits = 'credits_short',
  Running = 'deep_job_running',
  Blocked = 'blocked_by_moderation'
}

const MS_PER_S = 1000;

type Gate = { balance: number; quoteCredits: number; running: boolean };

const REFUSALS: { refusal: DeepRefusal; applies: (gate: Gate) => boolean }[] = [
  { refusal: DeepRefusal.Running, applies: (gate) => gate.running },
  { refusal: DeepRefusal.Credits, applies: (gate) => gate.balance < gate.quoteCredits }
];

export function deepRefusal(gate: Gate): DeepRefusal | null {
  return REFUSALS.find((r) => r.applies(gate))?.refusal ?? null;
}

export type DeepStartInput = {
  orgId: string;
  userId: string;
  project: { id: string; brandId: string | null };
  nodeId: string;
  message: string;
  model: string;
  requester: Actor;
};

export type DeepStart = { ok: true; view: DeepView } | { ok: false; error: DeepRefusal };

export async function startDeep(db: Db, input: DeepStartInput): Promise<DeepStart> {
  const { orgId, userId, project, nodeId, message, model } = input;
  const screened = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: [message], scope: { orgId, userId, projectId: project.id, nodeId, actor: input.requester } });
  if (!screened.ok) {
    return { ok: false, error: DeepRefusal.Blocked };
  }

  await ensureGatewayModels();
  const price = deepQuote(gatewayRate(model));
  const [balance, latest] = await Promise.all([orgCreditBalance(db, orgId), latestDeep(db, { orgId, nodeId })]);
  const refusal = deepRefusal({ balance, quoteCredits: price.credits, running: latest?.status === 'running' });
  if (refusal) {
    return { ok: false, error: refusal };
  }

  const threadId = await openNodeThread(db, { orgId, projectId: project.id, nodeId, userId, brandId: project.brandId });
  await saveTurn(db, { orgId, threadId, role: 'user', content: message, actor: input.requester });
  const run = await createDeepRun(db, {
    orgId,
    nodeId,
    params: { kind: DEEP_KIND, message, model, userId, threadId, quote: { usd: price.usd, credits: price.credits, capUsd: price.capUsd, capCredits: price.capCredits }, state: freshState(), spentUsd: 0, stop: false, assets: '', resumes: 0, end: null }
  });

  launchDeep(db, run.id);
  return { ok: true, view: deepView(run) };
}

export function launchDeep(db: Db, runId: string): void {
  const clock = { startedAt: Date.now(), maxMs: DEEP_MAX_DURATION_S * MS_PER_S };
  runInBackground(() => runDeepJob(db, runId, clock), 'motion-deep');
}
