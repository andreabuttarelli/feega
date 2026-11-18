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

type PushOpts = { name: string; title?: string; body?: string; base?: string; confirmSensitive?: boolean };

export async function cmdGithubPush(projectId: string, nodeIds: string[], opts: PushOpts) {
  await print(base(projectId), { method: 'POST', body: JSON.stringify({ ...opts, nodeIds }) });
}

export async function cmdGithubStatus(projectId: string, nodeId: string) {
  await print(`${base(projectId)}?${new URLSearchParams({ nodeId })}`);
}

export async function cmdGithubUndo(projectId: string, nodeId: string) {
  await print(`${base(projectId)}/undo`, { method: 'POST', body: JSON.stringify({ nodeId }) });
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
