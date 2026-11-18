import type { ProviderAnswer, ProviderCall } from '$lib/server/connections/account-links';
import type { GithubCall } from '$lib/server/code-import/github';

type Tree = Record<string, string>;
type Commit = { tree: string; parents: string[]; message: string };
type Pull = { number: number; head: string; base: string; title: string; body: string; state: 'open' | 'closed'; merged: boolean };
type TreeEntry = { path: string; content?: string; sha?: string | null };

export type FakeGithub = {
  call: GithubCall;
  files: (ref: string) => Tree;
  forcePush: (branch: string, files: Tree) => void;
  deleteBranch: (branch: string) => void;
  seed: (branch: string, files: Tree) => string;
  checks: Record<string, { name: string; status: string; conclusion: string | null }[]>;
  pulls: Pull[];
  calls: ProviderCall[];
  endPull: (number: number, merged: boolean) => void;
  failAfter: (count: number, status: number) => void;
  branches: () => string[];
  tag: (name: string, ref: string) => void;
};

const answer = (status: number, data: unknown = null): ProviderAnswer => ({ status, data, headers: {}, file: null });

export function fakeGithub(opts: { owner?: string; repo?: string; push?: boolean; defaultBranch?: string } = {}): FakeGithub {
  const root = `/repos/${opts.owner ?? 'acme'}/${opts.repo ?? 'app'}`;
  const defaultBranch = opts.defaultBranch ?? 'main';
  const trees = new Map<string, Tree>();
  const commits = new Map<string, Commit>();
  const refs = new Map<string, string>();
  const pulls: Pull[] = [];
  const checks: FakeGithub['checks'] = {};
  const calls: ProviderCall[] = [];
  let seq = 0;

  const id = (prefix: string) => `${prefix}${(++seq).toString(16).padStart(8, '0')}`;
  const saveTree = (files: Tree) => {
    const sha = id('t');
    trees.set(sha, { ...files });
    return sha;
  };
  const tags = new Map<string, string>();
  const saveCommit = (files: Tree, parents: string[]) => {
    const sha = id('c');
    commits.set(sha, { tree: saveTree(files), parents, message: 'seed' });
    return sha;
  };
  const treeOf = (sha: string) => trees.get(commits.get(sha)?.tree ?? '') ?? {};
  const ancestors = (sha: string): Set<string> => {
    const seen = new Set<string>();
    const walk = [sha];
    while (walk.length) {
      const at = walk.pop()!;
      if (seen.has(at)) {
        continue;
      }
      seen.add(at);
      walk.push(...(commits.get(at)?.parents ?? []));
    }
    return seen;
  };

  const seed = (branch: string, files: Tree) => {
    const parent = refs.get(branch);
    const sha = saveCommit(files, parent ? [parent] : []);
    refs.set(branch, sha);
    return sha;
  };
  seed(defaultBranch, { 'README.md': 'hi' });

  const pullJson = (p: Pull) => ({ number: p.number, title: p.title, html_url: `https://github.com${root.slice(6)}/pull/${p.number}`, state: p.state, merged: p.merged, head: { sha: refs.get(p.head) ?? '', ref: p.head } });

  let budget = Infinity;
  let failStatus = 0;

  const route = (r: ProviderCall): ProviderAnswer => {
    if (budget-- <= 0) {
      return answer(failStatus, { message: 'Bad credentials' });
    }
    const method = r.method ?? 'GET';
    const path = r.endpoint.slice(root.length);
    const body = (r.body ?? {}) as Record<string, unknown>;

    if (path === '' && method === 'GET') {
      return answer(200, { default_branch: defaultBranch, permissions: { push: opts.push ?? true, pull: true } });
    }
    let m = path.match(/^\/git\/ref\/heads\/(.+)$/);
    if (m && method === 'GET') {
      const sha = refs.get(decodeURIComponent(m[1]));
      return sha ? answer(200, { object: { sha } }) : answer(404, { message: 'Not Found' });
    }
    if (path === '/git/refs' && method === 'POST') {
      const name = String(body.ref).replace('refs/heads/', '');
      if (refs.has(name)) {
        return answer(422, { message: 'Reference already exists' });
      }
      refs.set(name, String(body.sha));
      return answer(201, { object: { sha: body.sha } });
    }
    m = path.match(/^\/git\/refs\/heads\/(.+)$/);
    if (m && method === 'PATCH') {
      const name = decodeURIComponent(m[1]);
      const current = refs.get(name);
      if (!current) {
        return answer(422, { message: 'Reference does not exist' });
      }
      if (!body.force && !ancestors(String(body.sha)).has(current)) {
        return answer(422, { message: 'Update is not a fast forward' });
      }
      refs.set(name, String(body.sha));
      return answer(200, { object: { sha: body.sha } });
    }
    m = path.match(/^\/git\/commits\/(\w+)$/);
    if (m && method === 'GET') {
      const c = commits.get(m[1]);
      return c ? answer(200, { sha: m[1], tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })) }) : answer(404);
    }
    if (path === '/git/trees' && method === 'POST') {
      const next = { ...(trees.get(String(body.base_tree)) ?? {}) };
      for (const e of body.tree as TreeEntry[]) {
        if (e.sha === null) {
          delete next[e.path];
          continue;
        }
        next[e.path] = e.content ?? '';
      }
      return answer(201, { sha: saveTree(next) });
    }
    if (path === '/git/commits' && method === 'POST') {
      const sha = id('c');
      commits.set(sha, { tree: String(body.tree), parents: body.parents as string[], message: String(body.message) });
      return answer(201, { sha, message: body.message });
    }
    m = path.match(/^\/compare\/(\w+)\.\.\.(.+)$/);
    if (m) {
      const head = refs.get(decodeURIComponent(m[2])) ?? m[2];
      if (!commits.has(m[1]) || !commits.has(head)) {
        return answer(404);
      }
      const behind = ancestors(head).has(m[1]);
      const status = m[1] === head ? 'identical' : behind ? 'ahead' : ancestors(m[1]).has(head) ? 'behind' : 'diverged';
      const before = treeOf(m[1]);
      const after = treeOf(head);
      const touched = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((p) => before[p] !== after[p]);
      const removed = touched.filter((p) => !(p in after));
      const renamedFrom = (p: string) => removed.find((r) => before[r] === after[p]) ?? null;
      const files = touched
        .filter((p) => !(removed.includes(p) && touched.some((q) => !(q in before) && after[q] === before[p])))
        .map((p) => {
          const from = !(p in before) ? renamedFrom(p) : null;
          return from ? { filename: p, status: 'renamed', previous_filename: from } : { filename: p, status: !(p in before) ? 'added' : !(p in after) ? 'removed' : 'modified' };
        });
      return answer(200, { status, files });
    }
    if (path === '/pulls' && method === 'GET') {
      const head = r.query?.head ? String(r.query.head).split(':')[1] : null;
      const state = r.query?.state ?? 'open';
      return answer(200, pulls.filter((p) => (head === null || p.head === head) && (state === 'all' || p.state === state)).reverse().map(pullJson));
    }
    if (path === '/branches' && method === 'GET') {
      return answer(200, [...refs].map(([name, sha]) => ({ name, commit: { sha } })));
    }
    if (path === '/tags' && method === 'GET') {
      return answer(200, [...tags].map(([name, sha]) => ({ name, commit: { sha } })));
    }
    if (path === '/commits' && method === 'GET') {
      const touches = (sha: string) => {
        const file = r.query?.path;
        const parent = commits.get(sha)?.parents[0];
        return !file || treeOf(sha)[file] !== (parent ? treeOf(parent)[file] : undefined);
      };
      const history: string[] = [];
      for (let at = refs.get(String(r.query?.sha)) ?? tags.get(String(r.query?.sha)) ?? String(r.query?.sha); commits.has(at); at = commits.get(at)!.parents[0]) {
        history.push(at);
      }
      const shown = history.filter(touches).slice(0, Number(r.query?.per_page ?? 30));
      return answer(200, shown.map((sha) => ({ sha, commit: { message: commits.get(sha)!.message, author: { name: 'Feega', date: '2026-11-17T00:00:00Z' } } })));
    }
    m = path.match(/^\/contents\/(.+)$/);
    if (m && method === 'GET') {
      const at = refs.get(String(r.query?.ref)) ?? String(r.query?.ref);
      const text = treeOf(at)[decodeURIComponent(m[1])];
      return text === undefined ? answer(404) : answer(200, { content: Buffer.from(text, 'utf8').toString('base64'), encoding: 'base64' });
    }
    if (path === '/pulls' && method === 'POST') {
      const p: Pull = { number: pulls.length + 1, head: String(body.head), base: String(body.base), title: String(body.title), body: String(body.body), state: 'open', merged: false };
      pulls.push(p);
      return answer(201, pullJson(p));
    }
    m = path.match(/^\/pulls\/(\d+)$/);
    if (m) {
      const p = pulls.find((x) => x.number === Number(m![1]));
      if (!p) {
        return answer(404);
      }
      if (method === 'PATCH') {
        Object.assign(p, { title: body.title ?? p.title, body: body.body ?? p.body });
      }
      return answer(200, pullJson(p));
    }
    m = path.match(/^\/commits\/(\w+)\/check-runs$/);
    if (m) {
      return answer(200, { check_runs: checks[m[1]] ?? [] });
    }
    return answer(404, { message: `fake: no route ${method} ${r.endpoint}` });
  };

  return {
    call: async (r) => {
      calls.push(r);
      return route(r);
    },
    files: (ref) => treeOf(refs.get(ref) ?? ref),
    forcePush: (branch, files) => {
      refs.set(branch, saveCommit(files, []));
    },
    deleteBranch: (branch) => {
      refs.delete(branch);
    },
    seed,
    endPull: (number, merged) => {
      const p = pulls.find((x) => x.number === number)!;
      p.state = 'closed';
      p.merged = merged;
    },
    failAfter: (count, status) => {
      budget = count;
      failStatus = status;
    },
    branches: () => [...refs.keys()],
    tag: (name, ref) => {
      tags.set(name, refs.get(ref) ?? ref);
    },
    checks,
    pulls,
    calls
  };
}
