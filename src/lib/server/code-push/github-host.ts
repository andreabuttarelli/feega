import type { ProviderAnswer, ProviderCall } from '$lib/server/connections/account-links';
import type { GithubCall } from '$lib/server/code-import/github';
import type { RepoRef } from '$lib/server/code-import/repo';
import { Access, FileMove, GitError, GitFailure, PullStatus, RefKind, type Check, type GitHost, type PullRef } from './git-host';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const FILE_MODE = '100644';
const BLOB = 'blob';
const PAGE_MAX = 100;
const ANCESTOR_STATES = new Set(['ahead', 'identical']);

const FAILURE_OF_STATUS: Record<number, GitFailure> = {
  [HTTP_UNAUTHORIZED]: GitFailure.Unauthorized,
  [HTTP_FORBIDDEN]: GitFailure.Forbidden,
  [HTTP_NOT_FOUND]: GitFailure.NotFound
};

const MOVE_OF_STATUS: Record<string, FileMove> = {
  added: FileMove.Added,
  removed: FileMove.Removed,
  renamed: FileMove.Renamed
};

type Json = Record<string, unknown>;
type Refusals = Partial<Record<number, GitFailure>>;

const ok = (status: number) => status >= HTTP_OK_MIN && status <= HTTP_OK_MAX;
const encoded = (path: string) => path.split('/').map(encodeURIComponent).join('/');
const pullRefOf = (data: Json): PullRef => ({ number: Number(data.number), url: String(data.html_url) });

function statusOf(data: Json): PullStatus {
  if (data.merged) {
    return PullStatus.Merged;
  }
  return data.state === 'open' ? PullStatus.Open : PullStatus.Closed;
}

export function githubHost(call: GithubCall, repo: RepoRef): GitHost {
  const root = `/repos/${repo.owner}/${repo.repo}`;

  const send = async (request: ProviderCall, refusals: Refusals = {}): Promise<Json> => {
    const answer: ProviderAnswer = await call({ ...request, endpoint: `${root}${request.endpoint}` });
    if (ok(answer.status)) {
      return (answer.data ?? {}) as Json;
    }
    throw new GitError(refusals[answer.status] ?? FAILURE_OF_STATUS[answer.status] ?? GitFailure.Unexpected, answer.status);
  };

  const branchGone: Refusals = { [HTTP_NOT_FOUND]: GitFailure.BranchGone };
  const refMoved: Refusals = { [HTTP_UNPROCESSABLE]: GitFailure.Diverged };

  const headOf = async (branch: string) => String(((await send({ endpoint: `/git/ref/heads/${encoded(branch)}` }, branchGone)).object as Json).sha);
  const treeOf = async (sha: string) => String(((await send({ endpoint: `/git/commits/${sha}` })).tree as Json).sha);

  const isAncestor = async (sha: string, head: string) => {
    const compared = await send({ endpoint: `/compare/${sha}...${head}` }, { [HTTP_NOT_FOUND]: GitFailure.Diverged }).catch((e: unknown) => {
      if (e instanceof GitError && e.failure === GitFailure.Diverged) {
        return { status: 'diverged' };
      }
      throw e;
    });
    return ANCESTOR_STATES.has(String(compared.status));
  };

  const list = async (endpoint: string, query: Record<string, string> = {}) => {
    const found = (await send({ endpoint, query: { per_page: String(PAGE_MAX), ...query } })) as unknown as Json[];
    return Array.isArray(found) ? found : [];
  };

  const refsOf = async (endpoint: string, kind: RefKind) => (await list(endpoint)).map((r) => ({ name: String(r.name), kind, sha: String((r.commit as Json).sha) }));

  const pullsOf = async (branch: string, state: string) => {
    const found = (await send({ endpoint: '/pulls', query: { head: `${repo.owner}:${branch}`, state } })) as unknown as Json[];
    return Array.isArray(found) ? found : [];
  };

  return {
    defaultBranch: async () => String((await send({ endpoint: '' })).default_branch),
    access: async () => (((await send({ endpoint: '' })).permissions as Json | undefined)?.push ? Access.Write : Access.Read),
    headOf,
    readFile: async (path, ref) => {
      const found = await send({ endpoint: `/contents/${encoded(path)}`, query: { ref } }).catch((e: unknown) => {
        if (e instanceof GitError && e.failure === GitFailure.NotFound) {
          return null;
        }
        throw e;
      });
      return typeof found?.content === 'string' ? Buffer.from(found.content, 'base64').toString('utf8') : null;
    },
    writeCommit: async (ask) => {
      const entries = ask.files.map((f) => ({ path: f.path, mode: FILE_MODE, type: BLOB, ...(f.content === null ? { sha: null } : { content: f.content }) }));
      const tree = String((await send({ endpoint: '/git/trees', method: 'POST', body: { base_tree: await treeOf(ask.parent), tree: entries } })).sha);
      return String((await send({ endpoint: '/git/commits', method: 'POST', body: { message: ask.message, tree, parents: [ask.parent] } })).sha);
    },
    createBranch: async (branch, sha) => {
      await send({ endpoint: '/git/refs', method: 'POST', body: { ref: `refs/heads/${branch}`, sha } }, refMoved);
    },
    moveBranch: async (branch, from, to) => {
      if ((await headOf(branch)) !== from) {
        throw new GitError(GitFailure.Diverged, HTTP_UNPROCESSABLE);
      }
      await send({ endpoint: `/git/refs/heads/${encoded(branch)}`, method: 'PATCH', body: { sha: to, force: false } }, refMoved);
    },
    isAncestor,
    lastPull: async (branch) => {
      const last = (await pullsOf(branch, 'all'))[0];
      return last ? { ...pullRefOf(last), status: statusOf(last) } : null;
    },
    upsertPull: async (ask) => {
      const open = (await pullsOf(ask.branch, 'open'))[0];
      if (open) {
        await send({ endpoint: `/pulls/${open.number}`, method: 'PATCH', body: { title: ask.title, body: ask.body } });
        return pullRefOf(open);
      }
      return pullRefOf(await send({ endpoint: '/pulls', method: 'POST', body: { title: ask.title, body: ask.body, head: ask.branch, base: ask.base } }));
    },
    pull: async (number) => {
      const data = await send({ endpoint: `/pulls/${number}` });
      const headSha = String((data.head as Json).sha);
      const runs = ((await send({ endpoint: `/commits/${headSha}/check-runs` })).check_runs ?? []) as Json[];
      const checks: Check[] = runs.map((r) => ({ name: String(r.name), status: String(r.status), conclusion: r.conclusion == null ? null : String(r.conclusion) }));
      return { ...pullRefOf(data), status: statusOf(data), headSha, checks };
    },
    changedSince: async (sha, ref) => {
      const files = ((await send({ endpoint: `/compare/${sha}...${encoded(ref)}` })).files ?? []) as Json[];
      return files.map((f) => ({ path: String(f.filename), move: MOVE_OF_STATUS[String(f.status)] ?? FileMove.Modified, from: f.previous_filename ? String(f.previous_filename) : null }));
    },
    listRefs: async () => [...(await refsOf('/branches', RefKind.Branch)), ...(await refsOf('/tags', RefKind.Tag))],
    listCommits: async (ref, ask) => {
      const found = await list('/commits', { sha: ref, per_page: String(Math.min(ask.limit, PAGE_MAX)), ...(ask.path ? { path: ask.path } : {}) });
      return found.map((c) => {
        const commit = c.commit as Json;
        const author = (commit.author ?? {}) as Json;
        return { sha: String(c.sha), message: String(commit.message).split('\n')[0], author: String(author.name ?? ''), at: String(author.date ?? '') };
      });
    },
    listPulls: async () => (await list('/pulls', { state: 'open' })).map((p) => ({ number: Number(p.number), title: String(p.title), branch: String((p.head as Json).ref), sha: String((p.head as Json).sha) }))
  };
}
