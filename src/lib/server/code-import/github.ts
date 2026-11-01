import type { ProviderAnswer, ProviderCall } from '$lib/server/connections/account-links';
import type { RepoRef } from './repo';

export type GithubCall = (request: ProviderCall) => Promise<ProviderAnswer>;

export type GithubRepo = { fullName: string; private: boolean; branch: string };

export enum Visibility {
  Public = 'public',
  Private = 'private',
  Unreachable = 'unreachable'
}

export const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;

const PAGE = '100';
const HTTP_OK = 200;
const HTTP_REDIRECT_MIN = 300;
const HTTP_REDIRECT_MAX = 399;
const ARCHIVE_TIMEOUT_MS = 120_000;

const listOf = (answer: ProviderAnswer): Record<string, unknown>[] => (answer.status === HTTP_OK && Array.isArray(answer.data) ? (answer.data as Record<string, unknown>[]) : []);

export async function reposOf(call: GithubCall): Promise<GithubRepo[]> {
  const answer = await call({ endpoint: '/user/repos', query: { per_page: PAGE, sort: 'pushed' } });
  return listOf(answer).map((r) => ({ fullName: String(r.full_name), private: Boolean(r.private), branch: String(r.default_branch ?? '') }));
}

export async function branchesOf(call: GithubCall, repo: RepoRef): Promise<string[]> {
  const answer = await call({ endpoint: `/repos/${repo.owner}/${repo.repo}/branches`, query: { per_page: PAGE } });
  return listOf(answer).map((b) => String(b.name));
}

export async function visibilityOf(call: GithubCall, repo: RepoRef): Promise<Visibility> {
  const answer = await call({ endpoint: `/repos/${repo.owner}/${repo.repo}` });
  if (answer.status !== HTTP_OK || !answer.data || typeof answer.data !== 'object') {
    return Visibility.Unreachable;
  }
  return (answer.data as { private?: boolean }).private ? Visibility.Private : Visibility.Public;
}

const redirected = (answer: ProviderAnswer) => (answer.status >= HTTP_REDIRECT_MIN && answer.status <= HTTP_REDIRECT_MAX ? (answer.headers.location ?? null) : null);

export async function archiveOf(call: GithubCall, repo: RepoRef, fetchFn: typeof fetch): Promise<Uint8Array | null> {
  const answer = await call({ endpoint: `/repos/${repo.owner}/${repo.repo}/tarball${repo.ref ? `/${repo.ref}` : ''}` });
  const url = answer.file ?? redirected(answer);
  if (!url) {
    return null;
  }
  const res = await fetchFn(url, { signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS) }).catch(() => null);
  if (!res?.ok || Number(res.headers.get('content-length') ?? 0) > MAX_ARCHIVE_BYTES) {
    return null;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.byteLength <= MAX_ARCHIVE_BYTES ? bytes : null;
}
