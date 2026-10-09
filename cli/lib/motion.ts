import { request } from './api.ts';
import { appUrl } from './config.ts';

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

export type RenderMode = 'browser' | 'server';
export type RenderStart = { mode: RenderMode; run_id: string; render_url?: string; expires_at?: string; revision?: number; credits: number };
export type RenderState = { run_id: string; mode: RenderMode; status: MotionRun['status']; asset_id: string | null; file_url: string | null; error: string | null; credits: number | null };
export type RenderOptions = { mode?: RenderMode; resolution?: string; format?: string; quality?: string; fps?: number };
export type MotionVideo = { node_id: string; name: string | null; project_id: string; canvas_id: string; format: string; version: number; poster_url: string | null; last_render_url: string | null; editor_url: string };
export type MotionFrames = { revision: number; frames: { time: number; mime: string; data: string }[]; quality: string[]; blocking: string[] };

export type MotionRevision = { version: number; summary: string | null; actorKind: string; createdAt: string; clips: number };

export type EmbedState = { published: boolean; url?: string; snippet?: string; revision?: number };

function renderBody(opts: RenderOptions): Record<string, unknown> {
  const settings = Object.fromEntries(Object.entries({ resolution: opts.resolution, format: opts.format, quality: opts.quality, fps: opts.fps }).filter(([, v]) => v !== undefined));
  return Object.keys(settings).length ? { mode: opts.mode ?? 'browser', settings } : { mode: opts.mode ?? 'browser' };
}

const SETTLED = new Set<MotionRun['status']>(['done', 'failed', 'expired']);

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => e[1] !== undefined));
  return params.size ? `${path}?${params}` : path;
}

const withOrg = (path: string, org?: string) => withQuery(path, { org });

async function download(path: string, token: string): Promise<string> {
  const res = await fetch(`${appUrl()}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
  return res.text();
}
const id = encodeURIComponent;

export const motionApi = {
  ask: (token: string, nodeId: string, prompt: string, org?: string) =>
    request<MotionRun>(withOrg(`/api/v1/motion/${id(nodeId)}/ask`, org), token, { method: 'POST', body: JSON.stringify({ prompt }) }),
  run: (token: string, runId: string, org?: string) => request<MotionRun>(withOrg(`/api/v1/motion/runs/${id(runId)}`, org), token),
  render: (token: string, nodeId: string, opts: RenderOptions, org?: string) =>
    request<RenderStart>(withOrg(`/api/v1/motion/${id(nodeId)}/render`, org), token, { method: 'POST', body: JSON.stringify(renderBody(opts)) }),
  renderState: (token: string, runId: string, org?: string) => request<RenderState>(withOrg(`/api/v1/motion/renders/${id(runId)}`, org), token),
  summary: (token: string, nodeId: string, org?: string) => request<Record<string, unknown>>(withOrg(`/api/v1/motion/${id(nodeId)}`, org), token),
  list: (token: string, projectId?: string, org?: string) => request<{ videos: MotionVideo[] }>(withQuery('/api/v1/motion', { project: projectId, org }), token),
  embed: (token: string, nodeId: string, org?: string) => request<EmbedState>(withOrg(`/api/v1/motion/${id(nodeId)}/embed`, org), token, { method: 'POST' }),
  unembed: (token: string, nodeId: string, org?: string) => request<EmbedState>(withOrg(`/api/v1/motion/${id(nodeId)}/embed`, org), token, { method: 'DELETE' }),
  embedState: (token: string, nodeId: string, org?: string) => request<EmbedState>(withOrg(`/api/v1/motion/${id(nodeId)}/embed`, org), token),
  frames: (token: string, nodeId: string, ask: { times: number[]; width?: number }, org?: string) =>
    request<MotionFrames>(withOrg(`/api/v1/motion/${id(nodeId)}/frames`, org), token, { method: 'POST', body: JSON.stringify(ask) }),
  revisions: (token: string, nodeId: string, org?: string) => request<{ revisions: MotionRevision[] }>(withOrg(`/api/v1/motion/${id(nodeId)}/revisions`, org), token),
  restore: (token: string, nodeId: string, version: number, org?: string) =>
    request<{ version: number; restored: number }>(withOrg(`/api/v1/motion/${id(nodeId)}/revisions`, org), token, { method: 'POST', body: JSON.stringify({ version }) }),
  bundle: (token: string, nodeId: string, org?: string) => download(withOrg(`/api/v1/motion/${id(nodeId)}/embed/bundle`, org), token)
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
