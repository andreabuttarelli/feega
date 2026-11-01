const UNAVAILABLE = 'unavailable';

export type CodeLanded = { nodes: unknown[]; undo: unknown[]; skipped: string[]; truncated: boolean; pages: string[]; components: number; variants: number; instances: number };

export type CodeTarget = { repo: string; routes: string[] } | { storybook: string };

export type CodeAsk = { projectId: string; canvasId: string; target: CodeTarget; at: { x: number; y: number } };

export type GithubStatus = { configured: boolean; connected: boolean; label: string | null };

export type GithubRepo = { fullName: string; private: boolean; branch: string };

type Answer<T> = { ok: true; value: T } | { ok: false; error: string; detail?: string };

async function asked<T>(url: string, init: RequestInit, fetchFn: typeof fetch): Promise<Answer<T>> {
  const res = await fetchFn(url, init).catch(() => null);
  if (!res?.ok) {
    const body = (await res?.json().catch(() => ({}))) as { error?: string; detail?: string } | undefined;
    return { ok: false, error: body?.error ?? UNAVAILABLE, ...(body?.detail ? { detail: body.detail } : {}) };
  }
  return { ok: true, value: (await res.json()) as T };
}

const JSON_POST = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export async function importCode(ask: CodeAsk, fetchFn: typeof fetch = fetch): Promise<{ ok: true; landed: CodeLanded } | { ok: false; error: string; detail?: string }> {
  const got = await asked<CodeLanded>(`/api/v1/projects/${ask.projectId}/code-import`, JSON_POST({ canvasId: ask.canvasId, ...ask.target, x: ask.at.x, y: ask.at.y }), fetchFn);
  return got.ok ? { ok: true, landed: got.value } : got;
}

const githubPath = (projectId: string, rest = '') => `/api/v1/projects/${projectId}/github${rest}`;

export const githubStatus = (projectId: string, fetchFn: typeof fetch = fetch) => asked<GithubStatus>(githubPath(projectId), {}, fetchFn);

export const githubConnect = (projectId: string, returnTo: string, fetchFn: typeof fetch = fetch) => asked<{ url: string }>(githubPath(projectId, '/connect'), JSON_POST({ returnTo }), fetchFn);

export const githubDisconnect = (projectId: string, fetchFn: typeof fetch = fetch) => asked<{ connected: false }>(githubPath(projectId), { method: 'DELETE' }, fetchFn);

export const githubRepos = (projectId: string, fetchFn: typeof fetch = fetch) => asked<{ repos: GithubRepo[] }>(githubPath(projectId, '/repos'), {}, fetchFn);

export const githubBranches = (projectId: string, repo: string, fetchFn: typeof fetch = fetch) => asked<{ branches: string[] }>(githubPath(projectId, `/branches?repo=${encodeURIComponent(repo)}`), {}, fetchFn);

export const repoLink = (fullName: string, branch: string | null) => `https://github.com/${fullName}${branch ? `/tree/${branch}` : ''}`;
