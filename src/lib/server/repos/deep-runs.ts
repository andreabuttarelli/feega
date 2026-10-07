import type { Db } from '$lib/server/db/client';
import { createRun, DEEP_JOB_PREFIX, runsByIds, type NodeRun } from '$lib/server/repos/node-runs';
import type { DeepEnd, DeepState } from '$lib/motion/deep';

export const DEEP_KIND = 'motion-deep';

export type DeepQuoteParams = { usd: number; credits: number; capUsd: number; capCredits: number };

export type DeepParams = {
  kind: typeof DEEP_KIND;
  message: string;
  model: string;
  userId: string;
  threadId: string;
  quote: DeepQuoteParams;
  state: DeepState;
  spentUsd: number;
  stop: boolean;
  assets: string;
  resumes: number;
  end: DeepEnd | null;
};

export type DeepRun = { run: NodeRun; params: DeepParams; heartbeatAt: string | null };

const isDeep = (run: NodeRun) => Boolean(run.externalJobId?.startsWith(DEEP_JOB_PREFIX));

export async function createDeepRun(db: Db, input: { orgId: string; nodeId: string; params: DeepParams }): Promise<NodeRun> {
  return createRun(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    prompt: input.params.message,
    model: input.params.model,
    params: input.params,
    actorKind: 'agent',
    actorId: input.params.userId,
    externalJobId: `${DEEP_JOB_PREFIX}${crypto.randomUUID()}`
  });
}

export async function readDeep(db: Db, runId: string): Promise<DeepRun | null> {
  const [run] = await runsByIds(db, { ids: [runId] });
  if (!run || !isDeep(run)) {
    return null;
  }
  const { data } = await db.from('node_runs').select('claimed_at').eq('id', runId).maybeSingle();
  return { run, params: run.params as DeepParams, heartbeatAt: (data as { claimed_at: string | null } | null)?.claimed_at ?? null };
}

export async function saveDeep(db: Db, input: { orgId: string; runId: string; params: DeepParams }): Promise<boolean> {
  const fresh = await readDeep(db, input.runId);
  const params = { ...input.params, stop: input.params.stop || Boolean(fresh?.params.stop) };
  const { error } = await db
    .from('node_runs')
    .update({ params: params as never, claimed_at: new Date().toISOString() })
    .eq('id', input.runId)
    .eq('org_id', input.orgId);
  if (error) {
    throw error;
  }
  return params.stop;
}

export async function requestStop(db: Db, input: { orgId: string; runId: string }): Promise<boolean> {
  const found = await readDeep(db, input.runId);
  if (!found || found.run.orgId !== input.orgId || found.run.status !== 'running') {
    return false;
  }
  const { error } = await db
    .from('node_runs')
    .update({ params: { ...found.params, stop: true } as never })
    .eq('id', input.runId)
    .eq('org_id', input.orgId);
  if (error) {
    throw error;
  }
  return true;
}

export async function endDeep(db: Db, input: { orgId: string; runId: string; params: DeepParams; costUsd: number; error: string | null }): Promise<void> {
  const { error } = await db
    .from('node_runs')
    .update({ status: input.error ? 'failed' : 'done', error: input.error, params: input.params as never, cost_usd: input.costUsd, finished_at: new Date().toISOString() })
    .eq('id', input.runId)
    .eq('org_id', input.orgId);
  if (error) {
    throw error;
  }
}

export async function latestDeep(db: Db, scope: { orgId: string; nodeId: string }): Promise<NodeRun | null> {
  const { data, error } = await db
    .from('node_runs')
    .select('id')
    .eq('org_id', scope.orgId)
    .eq('node_id', scope.nodeId)
    .like('external_job_id', `${DEEP_JOB_PREFIX}%`)
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) {
    throw error;
  }
  const id = (data ?? [])[0]?.id;
  return id ? ((await runsByIds(db, { ids: [id] }))[0] ?? null) : null;
}

export async function staleDeepRuns(db: Db, input: { before: string; limit: number }): Promise<{ id: string; orgId: string; heartbeatAt: string | null }[]> {
  const { data, error } = await db
    .from('node_runs')
    .select('id, org_id, claimed_at')
    .eq('status', 'running')
    .like('external_job_id', `${DEEP_JOB_PREFIX}%`)
    .or(`claimed_at.lt.${input.before},and(claimed_at.is.null,started_at.lt.${input.before})`)
    .limit(input.limit);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({ id: row.id, orgId: row.org_id, heartbeatAt: row.claimed_at }));
}

export async function claimStale(db: Db, input: { orgId: string; runId: string; seen: string | null }): Promise<boolean> {
  const query = db.from('node_runs').update({ claimed_at: new Date().toISOString() }).eq('id', input.runId).eq('org_id', input.orgId).eq('status', 'running');
  const { data, error } = await (input.seen === null ? query.is('claimed_at', null) : query.eq('claimed_at', input.seen)).select('id');
  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

export async function beatDeep(db: Db, input: { orgId: string; runId: string }): Promise<void> {
  const { error } = await db.from('node_runs').update({ claimed_at: new Date().toISOString() }).eq('id', input.runId).eq('org_id', input.orgId).eq('status', 'running');
  if (error) {
    throw error;
  }
}

export async function parkDeep(db: Db, input: { orgId: string; runId: string; params: DeepParams }): Promise<void> {
  const { error } = await db.from('node_runs').update({ params: input.params as never, claimed_at: null }).eq('id', input.runId).eq('org_id', input.orgId);
  if (error) {
    throw error;
  }
}
