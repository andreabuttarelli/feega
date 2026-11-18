import type { GithubCall } from '$lib/server/code-import/github';
import { repoOf } from '$lib/server/code-import/repo';
import { git } from './git-cli';
import type { GitHost } from './git-host';
import { githubHost } from './github-host';
import { CodeSourceKind } from './link';
import { localGitHost, Publish } from './local-git-host';

export const GITHUB_API = 'https://api.github.com';

const FETCH_TIMEOUT_MS = 30_000;
const ORIGIN_URL = /github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/;

export type HostEnv = { GITHUB_PUSH_TOKEN?: string; GITHUB_API_URL?: string };

export type HostSources = {
  connected: () => Promise<GithubCall | null>;
  env: HostEnv;
  folder: (raw: string) => string | null;
};

export function tokenCall(token: string, apiBase: string, fetchFn: typeof fetch = fetch): GithubCall {
  return async (request) => {
    const url = new URL(`${apiBase.replace(/\/$/, '')}${request.endpoint}`);
    Object.entries(request.query ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetchFn(url, {
      method: request.method ?? 'GET',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    }).catch(() => null);
    return res ? { status: res.status, data: await res.json().catch(() => null), headers: {}, file: null } : { status: 0, data: null, headers: {}, file: null };
  };
}

async function githubCall(sources: HostSources): Promise<GithubCall | null> {
  const connected = await sources.connected().catch(() => null);
  if (connected) {
    return connected;
  }
  return sources.env.GITHUB_PUSH_TOKEN ? tokenCall(sources.env.GITHUB_PUSH_TOKEN, sources.env.GITHUB_API_URL || GITHUB_API) : null;
}

async function originRepo(dir: string) {
  const url = (await git(dir, ['remote', 'get-url', 'origin'])).out.trim();
  const m = url.match(ORIGIN_URL);
  return { hasOrigin: url !== '', github: m ? repoOf(`https://github.com/${m[1]}/${m[2]}`) : null };
}

type HostOf = (sources: HostSources, repo: string) => Promise<GitHost | null>;

const HOSTS: Record<CodeSourceKind, HostOf> = {
  [CodeSourceKind.Github]: async (sources, repoName) => {
    const repo = repoOf(`https://github.com/${repoName}`);
    const call = repo ? await githubCall(sources) : null;
    return repo && call ? githubHost(call, repo) : null;
  },
  [CodeSourceKind.Folder]: async (sources, raw) => {
    const dir = sources.folder(raw);
    if (!dir) {
      return null;
    }
    const origin = await originRepo(dir);
    const call = origin.github ? await githubCall(sources) : null;
    const pulls = origin.github && call ? githubHost(call, origin.github) : null;
    return localGitHost(dir, { publish: origin.hasOrigin ? Publish.Origin : Publish.Local, pulls });
  }
};

export const hostOf = (sources: HostSources) => (source: CodeSourceKind, repo: string) => HOSTS[source](sources, repo);
