import { loadSession } from '../lib/auth.ts';
import { requestRaw } from '../lib/api.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

const base = (projectId: string) => `/api/v1/projects/${encodeURIComponent(projectId)}/github/push`;

async function print(path: string, init?: RequestInit) {
  const { status, body } = await requestRaw(path, await token(), init);
  console.log(JSON.stringify(body, null, 2));
  if (status >= 400) {
    process.exit(1);
  }
}

type PushOpts = { name: string; title?: string; body?: string; base?: string; confirmSensitive?: boolean; main?: string[]; variant?: string[] };

const variantOf = (raw: string) => {
  const [nodeId, choice, route] = raw.split(':');
  return { nodeId, choice, ...(route ? { route } : {}) };
};

export async function cmdGithubPush(projectId: string, nodeIds: string[], { main, variant, ...opts }: PushOpts) {
  await print(base(projectId), { method: 'POST', body: JSON.stringify({ ...opts, nodeIds, ...(main ? { mains: main } : {}), ...(variant ? { variants: variant.map(variantOf) } : {}) }) });
}

export async function cmdGithubStatus(projectId: string, nodeId: string) {
  await print(`${base(projectId)}?${new URLSearchParams({ nodeId })}`);
}

export async function cmdGithubBranch(projectId: string, nodeIds: string[], opts: { branch: string; from?: string }) {
  await print(`${base(projectId)}/branch`, { method: 'POST', body: JSON.stringify({ nodeIds, ...opts }) });
}

export async function cmdGithubPull(projectId: string, nodeId: string, opts: { base?: string; title?: string; ready?: boolean }) {
  await print(`${base(projectId)}/pull`, { method: 'POST', body: JSON.stringify({ nodeId, base: opts.base, title: opts.title, kind: opts.ready ? 'ready' : 'draft' }) });
}

export async function cmdGithubReady(projectId: string, nodeId: string) {
  await print(`${base(projectId)}/ready`, { method: 'POST', body: JSON.stringify({ nodeId }) });
}

export async function cmdGithubUndo(projectId: string, nodeId: string) {
  await print(`${base(projectId)}/undo`, { method: 'POST', body: JSON.stringify({ nodeId }) });
}

export async function cmdGithubVariant(projectId: string, canvasId: string, nodeId: string) {
  await print(`${base(projectId)}/variant`, { method: 'POST', body: JSON.stringify({ canvasId, nodeId }) });
}

export async function cmdGithubConflicts(projectId: string, nodeId: string) {
  await print(`${base(projectId)}/conflicts?${new URLSearchParams({ nodeId })}`);
}

export async function cmdGithubResolve(projectId: string, nodeId: string, choice: string) {
  await print(`${base(projectId)}/conflicts`, { method: 'POST', body: JSON.stringify({ nodeId, choice }) });
}

export async function cmdGithubDetach(projectId: string, nodeId: string) {
  await print(`${base(projectId)}?${new URLSearchParams({ nodeId })}`, { method: 'DELETE' });
}

export async function cmdGithubVersions(projectId: string, nodeId: string, opts: { ref?: string; limit?: string }) {
  const limit = opts.limit ? Number(opts.limit) : undefined;
  await print(`/api/v1/projects/${encodeURIComponent(projectId)}/github/versions`, { method: 'POST', body: JSON.stringify({ nodeId, ref: opts.ref, limit }) });
}

export async function cmdGithubCompare(projectId: string, nodeId: string, refs: string[]) {
  await print(`/api/v1/projects/${encodeURIComponent(projectId)}/github/compare`, { method: 'POST', body: JSON.stringify({ nodeId, refs }) });
}

export async function cmdGithubVersionRef(projectId: string, versionId: string, ref: string) {
  await print(`/api/v1/projects/${encodeURIComponent(projectId)}/github/compare`, { method: 'POST', body: JSON.stringify({ versionId, ref }) });
}

export async function cmdGithubVersionAction(projectId: string, versionId: string, action: string) {
  await print(`/api/v1/projects/${encodeURIComponent(projectId)}/github/version-actions`, { method: 'POST', body: JSON.stringify({ versionId, action }) });
}
