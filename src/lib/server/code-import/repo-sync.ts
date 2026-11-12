import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { changedLook, LOOK, LookKey, mapClips, minSideOf } from '$lib/canvas/code-look';
import type { ProviderCall } from '$lib/server/connections/account-links';
import type { GithubCall } from './github';
import type { RepoRef } from './repo';
import { unbound, type FileChange, type ReadFile } from './write-back';

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const GITHUB_API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const FETCH_TIMEOUT_MS = 15_000;

const ok = (status: number) => status >= HTTP_OK_MIN && status <= HTTP_OK_MAX;
const field = (data: unknown, key: string): string | null => (data && typeof data === 'object' && typeof (data as Record<string, unknown>)[key] === 'string' ? ((data as Record<string, unknown>)[key] as string) : null);
const repoPath = (repo: RepoRef) => `/repos/${repo.owner}/${repo.repo}`;
const encoded = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export function tokenCall(token: string, fetchFn: typeof fetch = fetch): GithubCall {
  return async (request: ProviderCall) => {
    const url = new URL(`${GITHUB_API}${request.endpoint}`);
    Object.entries(request.query ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetchFn(url, {
      method: request.method ?? 'GET',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    return { status: res.status, data: await res.json().catch(() => null), headers: {}, file: null };
  };
}

export function rawReader(repo: RepoRef, sha: string, call: GithubCall | null, fetchFn: typeof fetch = fetch): ReadFile {
  if (call) {
    return async (path) => {
      const got = await call({ endpoint: `${repoPath(repo)}/contents/${encoded(path)}`, query: { ref: sha } });
      const content = ok(got.status) ? field(got.data, 'content') : null;
      return content === null ? null : Buffer.from(content, 'base64').toString('utf8');
    };
  }
  return async (path) => {
    const res = await fetchFn(`${RAW}/${repo.owner}/${repo.repo}/${sha}/${encoded(path)}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return res.ok ? res.text() : null;
  };
}

export async function headOf(call: GithubCall | null, repo: RepoRef, branch: string | null, fetchFn: typeof fetch = fetch): Promise<string | null> {
  const endpoint = `${repoPath(repo)}/commits/${encodeURIComponent(branch ?? 'HEAD')}`;
  if (call) {
    const got = await call({ endpoint });
    return ok(got.status) ? field(got.data, 'sha') : null;
  }
  const res = await fetchFn(`${GITHUB_API}${endpoint}`, { headers: { accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  return res.ok ? field(await res.json(), 'sha') : null;
}

export type PullAsk = { base: string; branch: string; title: string; body?: string; files: FileChange[] };

export type Pulled = { url: string; branch: string };

export async function openPullRequest(call: GithubCall, repo: RepoRef, ask: PullAsk): Promise<Pulled | null> {
  const info = await call({ endpoint: repoPath(repo) });
  const target = ok(info.status) ? field(info.data, 'default_branch') : null;
  if (!target || ask.branch === target) {
    return null;
  }

  const ref = await call({ endpoint: `${repoPath(repo)}/git/refs`, method: 'POST', body: { ref: `refs/heads/${ask.branch}`, sha: ask.base } });
  if (!ok(ref.status)) {
    return null;
  }

  for (const file of ask.files) {
    const endpoint = `${repoPath(repo)}/contents/${encoded(file.path)}`;
    const blob = field((await call({ endpoint, query: { ref: ask.branch } })).data, 'sha');
    const put = await call({ endpoint, method: 'PUT', body: { message: `${ask.title}: ${file.path}`, content: Buffer.from(file.after, 'utf8').toString('base64'), branch: ask.branch, ...(blob ? { sha: blob } : {}) } });
    if (!ok(put.status)) {
      return null;
    }
  }

  const pr = await call({ endpoint: `${repoPath(repo)}/pulls`, method: 'POST', body: { title: ask.title, head: ask.branch, base: target, body: ask.body ?? '' } });
  const url = ok(pr.status) ? field(pr.data, 'html_url') : null;
  return url ? { url, branch: ask.branch } : null;
}

export type Rebased = { doc: MotionDoc; carried: number; conflicts: string[] };

const clipsOf = (doc: MotionDoc): MotionClip[] => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);
const fileOf = (at: string) => at.replace(/:\d+:\d+$/, '');
const wasKey = (clip: MotionClip) => `${fileOf(clip.source!.at)}|${clip.source!.cond ?? ''}|${JSON.stringify(clip.source!.was)}`;

export function rebased(local: MotionDoc, upstream: MotionDoc): Rebased {
  const side = minSideOf(local);
  const upSide = minSideOf(upstream);
  const ownLook = (c: MotionClip) => unbound(c, changedLook(c, side));
  const edited = clipsOf(local).filter((c) => c.source && Object.keys(ownLook(c)).length);
  const sourced = clipsOf(upstream).filter((c) => c.source);
  const byAt = new Map(sourced.map((c) => [`${c.source!.at}|${c.source!.cond ?? ''}`, c]));
  const byWas = new Map(sourced.map((c) => [wasKey(c), c]));
  const plans = new Map<string, MotionClip>();
  const conflicts: string[] = [];
  let carried = 0;

  for (const mine of edited) {
    const theirs = byWas.get(wasKey(mine)) ?? byAt.get(`${mine.source!.at}|${mine.source!.cond ?? ''}`);
    if (!theirs) {
      conflicts.push(`${mine.source!.at}: the element is gone upstream, edit dropped`);
      continue;
    }
    let next = plans.get(theirs.id) ?? theirs;
    for (const [key, value] of Object.entries(ownLook(mine))) {
      if (theirs.source!.was[key] !== mine.source!.was[key]) {
        conflicts.push(`${mine.source!.at}: ${key} changed on GitHub too, kept GitHub's`);
        continue;
      }
      next = LOOK[key as LookKey].write(next, value, upSide);
    }
    if (next !== theirs) {
      plans.set(theirs.id, next);
      carried++;
    }
  }

  return { doc: mapClips(upstream, (c) => plans.get(c.id) ?? c), carried, conflicts };
}

