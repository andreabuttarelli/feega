import { request } from './api.ts';

export type MotionRun = {
  run_id: string;
  node_id?: string;
  status: 'running' | 'finishing' | 'done' | 'failed' | 'expired';
  prompt?: string | null;
  reply?: string | null;
  summary?: string | null;
  version?: number | null;
  revision?: string | null;
  cost_usd?: number | null;
  error?: string | null;
  editor_url?: string;
};

export const RUN_POLL_MS = 3_000;
export const RUN_WAIT_MS = 240_000;

const SETTLED = new Set<MotionRun['status']>(['done', 'failed', 'expired']);

const withOrg = (path: string, org?: string) => (org ? `${path}?${new URLSearchParams({ org })}` : path);
const id = encodeURIComponent;

export const motionApi = {
  ask: (token: string, nodeId: string, prompt: string, org?: string) =>
    request<MotionRun>(withOrg(`/api/v1/motion/${id(nodeId)}/ask`, org), token, { method: 'POST', body: JSON.stringify({ prompt }) }),
  run: (token: string, runId: string, org?: string) => request<MotionRun>(withOrg(`/api/v1/motion/runs/${id(runId)}`, org), token),
  summary: (token: string, nodeId: string, org?: string) => request<Record<string, unknown>>(withOrg(`/api/v1/motion/${id(nodeId)}`, org), token)
};

export type Wait = { org?: string; timeoutMs?: number; pollMs?: number };

export async function awaitRun(token: string, run: MotionRun, wait: Wait = {}): Promise<MotionRun> {
  const deadline = Date.now() + (wait.timeoutMs ?? RUN_WAIT_MS);
  let current = run;
  while (!SETTLED.has(current.status) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, wait.pollMs ?? RUN_POLL_MS));
    current = await motionApi.run(token, current.run_id, wait.org);
  }
  return current;
}
