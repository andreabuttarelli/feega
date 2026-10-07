import type { Db } from '$lib/server/db/client';
import { DeepEnd, type DeepView } from '$lib/motion/deep';
import { motionOf } from '$lib/canvas/motion-node';
import { findNode } from '$lib/server/repos/canvas';
import { findProjectById } from '$lib/server/repos/projects';
import { saveTurn } from '$lib/server/repos/chat';
import { agentActor } from '$lib/server/repos/actor';
import { gatewayRate } from '$lib/server/openrouter-models';
import type { NodeRun } from '$lib/server/repos/node-runs';
import { beatDeep, endDeep, parkDeep, readDeep, saveDeep, type DeepParams } from '$lib/server/repos/deep-runs';
import { DEEP_AGENT_KEY, deepPorts } from './agent';
import { runDeep, type DeepLimits } from './loop';
import { creditsOfUsd, roundUsd } from './budget';
import { DEEP_PHASE_MS, DEEP_ROUNDS } from './limits';

export const MAX_RESUMES = 6;
const HEARTBEAT_MS = 45_000;
const STOPPED_REPLY = 'Stopped. The video keeps everything built up to now.';
const GAVE_UP = 'the job stopped answering too many times';

export function deepView(run: NodeRun): DeepView {
  const params = run.params as DeepParams;
  return {
    runId: run.id,
    status: run.status,
    phase: params.state.phase,
    iteration: params.state.iteration,
    maxIterations: DEEP_ROUNDS.max,
    notes: params.state.notes,
    verdict: params.state.verdict,
    quoteCredits: params.quote.credits,
    capCredits: params.quote.capCredits,
    spentCredits: creditsOfUsd(params.spentUsd),
    stopping: params.stop,
    summary: params.state.summary,
    error: run.error,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt
  };
}

function limitsOf(params: DeepParams): DeepLimits {
  return { minIterations: DEEP_ROUNDS.min, maxIterations: DEEP_ROUNDS.max, capUsd: params.quote.capUsd, roundUsd: roundUsd(gatewayRate(params.model)), phaseMs: DEEP_PHASE_MS };
}

type Settle = (db: Db, run: NodeRun, params: DeepParams) => Promise<void>;

const reply = (db: Db, run: NodeRun, params: DeepParams, content: string) =>
  saveTurn(db, { orgId: run.orgId, threadId: params.threadId, role: 'assistant', content, actor: agentActor(params.userId, DEEP_AGENT_KEY) });

const SETTLE: Record<DeepEnd, Settle> = {
  [DeepEnd.Paused]: async (db, run, params) => {
    await parkDeep(db, { orgId: run.orgId, runId: run.id, params });
  },
  [DeepEnd.Finished]: async (db, run, params) => {
    await reply(db, run, params, params.state.summary ?? 'Done.');
    await endDeep(db, { orgId: run.orgId, runId: run.id, params, costUsd: params.spentUsd, error: null });
  },
  [DeepEnd.Stopped]: async (db, run, params) => {
    await reply(db, run, params, STOPPED_REPLY);
    await endDeep(db, { orgId: run.orgId, runId: run.id, params, costUsd: params.spentUsd, error: null });
  },
  [DeepEnd.Failed]: async (db, run, params) => {
    await endDeep(db, { orgId: run.orgId, runId: run.id, params, costUsd: params.spentUsd, error: 'failed' });
  }
};

export type JobClock = { startedAt: number; maxMs: number };

export async function runDeepJob(db: Db, runId: string, clock: JobClock): Promise<DeepEnd | null> {
  const found = await readDeep(db, runId);
  if (!found || found.run.status !== 'running') {
    return null;
  }
  const { run } = found;
  let params: DeepParams = { ...found.params, end: null };

  const record = await findNode(db, { orgId: run.orgId, nodeId: run.nodeId });
  const node = record ? motionOf(record) : null;
  const project = record ? await findProjectById(db, { orgId: run.orgId, projectId: record.projectId }) : null;
  if (!record || !node || !project) {
    await endDeep(db, { orgId: run.orgId, runId, params, costUsd: params.spentUsd, error: 'the motion node is gone' });
    return DeepEnd.Failed;
  }

  const heartbeat = setInterval(() => void beatDeep(db, { orgId: run.orgId, runId }).catch((e) => console.error('[motion-deep] heartbeat failed', e)), HEARTBEAT_MS);
  try {
    const ports = await deepPorts(
      { db, orgId: run.orgId, userId: params.userId, threadId: params.threadId, project: { id: project.id, brandId: project.brandId }, motion: { record, node }, model: params.model, brief: params.message, startedAt: clock.startedAt, maxMs: clock.maxMs, capUsd: params.quote.capUsd, spentBefore: params.spentUsd, assetsNote: params.assets },
      {
        checkpoint: async (state, extra) => {
          params = { ...params, state, spentUsd: extra.spentUsd, assets: extra.assets };
          params.stop = await saveDeep(db, { orgId: run.orgId, runId, params });
        },
        stopped: async () => params.stop || Boolean((await readDeep(db, runId))?.params.stop)
      }
    );
    const outcome = await runDeep(ports, params.state, limitsOf(params));
    params = { ...params, state: outcome.state, spentUsd: ports.spentUsd(), end: outcome.end };
    await SETTLE[outcome.end](db, run, params);
    return outcome.end;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[motion-deep] job failed', { runId }, e);
    await endDeep(db, { orgId: run.orgId, runId, params: { ...params, end: DeepEnd.Failed }, costUsd: params.spentUsd, error });
    return DeepEnd.Failed;
  } finally {
    clearInterval(heartbeat);
  }
}

export type StaleRow = { id: string; orgId: string; heartbeatAt: string | null };

export type ResumePorts = {
  stale: () => Promise<StaleRow[]>;
  claim: (row: StaleRow) => Promise<boolean>;
  resumes: (row: StaleRow) => Promise<number>;
  fail: (runId: string) => Promise<void>;
  trigger: (runId: string) => Promise<void>;
};

export async function resumeDeepRuns(ports: ResumePorts): Promise<number> {
  let resumed = 0;
  for (const row of await ports.stale()) {
    if (!(await ports.claim(row))) {
      continue;
    }
    if ((await ports.resumes(row)) >= MAX_RESUMES) {
      await ports.fail(row.id);
      continue;
    }
    await ports.trigger(row.id);
    resumed += 1;
  }
  return resumed;
}

export async function countResume(db: Db, runId: string): Promise<number> {
  const found = await readDeep(db, runId);
  if (!found) {
    return MAX_RESUMES;
  }
  const params = { ...found.params, resumes: found.params.resumes + 1 };
  await saveDeep(db, { orgId: found.run.orgId, runId, params });
  return found.params.resumes;
}

export async function giveUp(db: Db, runId: string): Promise<void> {
  const found = await readDeep(db, runId);
  if (!found) {
    return;
  }
  await endDeep(db, { orgId: found.run.orgId, runId, params: { ...found.params, end: DeepEnd.Failed }, costUsd: found.params.spentUsd, error: GAVE_UP });
}
