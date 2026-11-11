const UNAVAILABLE = 'unavailable';

export type DesignLanded = { tokens: number; byClass: number; byRule: number; byValue: number; unbound: number };

export type CodeLanded = { nodes: unknown[]; undo: unknown[]; skipped: string[]; truncated: boolean; pages: string[]; components: number; variants: number; instances: number; design?: DesignLanded };

export type RenderCondition = { scheme: 'light' | 'dark'; width: number };

export type CodeTarget = { repo: string; routes: string[]; conditions?: RenderCondition[]; designSystem?: boolean } | { folder: string; routes: string[]; conditions?: RenderCondition[]; designSystem?: boolean } | { upload: string; routes: string[]; conditions?: RenderCondition[]; designSystem?: boolean } | { storybook: string };

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

export async function tokensFound(projectId: string, where: { repo: string } | { folder: string }, fetchFn: typeof fetch = fetch): Promise<number> {
  const got = await asked<{ tokens: number }>(`/api/v1/projects/${projectId}/code-import/tokens?${new URLSearchParams(where)}`, {}, fetchFn);
  return got.ok ? got.value.tokens : 0;
}

const githubPath = (projectId: string, rest = '') => `/api/v1/projects/${projectId}/github${rest}`;

export const githubStatus = (projectId: string, fetchFn: typeof fetch = fetch) => asked<GithubStatus>(githubPath(projectId), {}, fetchFn);

export const githubConnect = (projectId: string, returnTo: string, fetchFn: typeof fetch = fetch) => asked<{ url: string }>(githubPath(projectId, '/connect'), JSON_POST({ returnTo }), fetchFn);

export const githubDisconnect = (projectId: string, fetchFn: typeof fetch = fetch) => asked<{ connected: false }>(githubPath(projectId), { method: 'DELETE' }, fetchFn);

export const githubRepos = (projectId: string, fetchFn: typeof fetch = fetch) => asked<{ repos: GithubRepo[] }>(githubPath(projectId, '/repos'), {}, fetchFn);

export const githubBranches = (projectId: string, repo: string, fetchFn: typeof fetch = fetch) => asked<{ branches: string[] }>(githubPath(projectId, `/branches?repo=${encodeURIComponent(repo)}`), {}, fetchFn);

export const repoLink = (fullName: string, branch: string | null) => `https://github.com/${fullName}${branch ? `/tree/${branch}` : ''}`;

export type RepoChanges = { kind: 'github' | 'folder' | 'upload'; repo: string; sha: string; patch: string; files: string[]; skipped: string[] };

export type RepoPublished = { url: string | null; branch: string | null; files: string[]; skipped: string[] };

export type RepoHead = { kind: 'github' | 'folder' | 'upload'; sha: string | null; head: string | null };

export type RepoPulled = { outcome: 'ok' | 'up_to_date'; sha: string; carried: number; conflicts: string[]; skipped: string[] };

const syncPath = (projectId: string, nodeId: string, rest: string) => `/api/v1/projects/${projectId}/code-import/${nodeId}/${rest}`;

export const repoChanges = (projectId: string, nodeId: string, fetchFn: typeof fetch = fetch) => asked<RepoChanges>(syncPath(projectId, nodeId, 'changes'), {}, fetchFn);

export const repoPublish = (projectId: string, nodeId: string, fetchFn: typeof fetch = fetch) => asked<RepoPublished>(syncPath(projectId, nodeId, 'publish'), JSON_POST({}), fetchFn);

export const repoHead = (projectId: string, nodeId: string, fetchFn: typeof fetch = fetch) => asked<RepoHead>(syncPath(projectId, nodeId, 'head'), {}, fetchFn);

export const repoPull = (projectId: string, nodeId: string, branch: string, fetchFn: typeof fetch = fetch) => asked<RepoPulled>(syncPath(projectId, nodeId, 'pull'), JSON_POST(branch ? { branch } : {}), fetchFn);

export type FolderUpload = { path: string; uploadUrl: string; mimeType: string };

export async function uploadFolder(projectId: string, name: string, archive: Uint8Array, fetchFn: typeof fetch = fetch): Promise<Answer<string>> {
  const signed = await asked<FolderUpload>(`/api/v1/projects/${projectId}/code-uploads`, JSON_POST({ name }), fetchFn);
  if (!signed.ok) {
    return signed;
  }
  const put = await fetchFn(signed.value.uploadUrl, { method: 'PUT', headers: { 'content-type': signed.value.mimeType }, body: new Blob([archive as BlobPart]) }).catch(() => null);
  return put?.ok ? { ok: true, value: signed.value.path } : { ok: false, error: UNAVAILABLE };
}
