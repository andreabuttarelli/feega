import { Access, GitError, GitFailure, PullStatus, WIP_PREFIX, type FileChanged, type FileWrite, type GitHost, type PullRef, type PullState } from './git-host';
import type { PushLock } from './push-lock';
import { isEnvFile, isSensitive, withSecrets } from './secrets';

export const BRANCH_PREFIX = 'feega/';

const SYNC_SUFFIX = '-sync';
const CYCLE = /^(.*?)(?:-(\d+))?$/;
const FIRST_NEXT_CYCLE = 2;
const SLUG_FALLBACK = 'session';
const UNDO_TITLE = 'Undo the last push from Feega';

export enum PushRefusal {
  ReadOnly = 'read_only',
  EnvFile = 'env_file',
  Secret = 'secret',
  NeedsConfirm = 'needs_confirm',
  NoFiles = 'no_files',
  Busy = 'busy',
  Protected = 'protected',
  Conflict = 'conflict',
  SameBranch = 'same_branch'
}

export enum PullKind {
  Draft = 'draft',
  Ready = 'ready'
}

const WIP_MESSAGE = 'Feega autosave (work in progress)';

export enum Fallback {
  Diverged = 'diverged',
  BranchGone = 'branch_gone',
  Protected = 'protected'
}

export type LastPush = { branch: string; sha: string };

export type PushAsk = { name: string; files: { path: string; content: string }[]; title: string; body: string; coAuthors?: string[]; since?: LastPush; base?: string; confirmSensitive?: boolean; branch?: string };

export type Pushed = { ok: true; branch: string; sha: string; parent: string; touched: string[]; pull: PullRef | null; fallback?: Fallback };

export type PushRefused = { ok: false; refusal: PushRefusal | GitFailure; paths?: string[] };

export type Undone = { ok: true; branch: string; sha: string };

export type Readied = { ok: true; number: number };

export type Saved = { ok: true; ref: string; sha: string };

export type CheckedOut = { ok: true; branch: string; head: string; created: boolean; pull: PullRef | null };

export type PullOpened = { ok: true; pull: PullRef };

export type PullAskOf = { branch: string; base: string; title: string; body: string; kind: PullKind };

export type PushState = { ok: true; branch: string; head: string; diverged: boolean; upstream: FileChanged[]; pull: PullState | null };

export const sessionBranch = (name: string) => `${BRANCH_PREFIX}${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || SLUG_FALLBACK}`;

export function nextCycle(branch: string): string {
  const [, stem, n] = branch.match(CYCLE)!;
  return `${stem}-${n ? Number(n) + 1 : FIRST_NEXT_CYCLE}`;
}

const messageOf = (title: string, coAuthors: string[]) => [title, ...(coAuthors.length ? ['', ...coAuthors.map((a) => `Co-authored-by: ${a}`)] : [])].join('\n');

const FALLBACK_OF: Partial<Record<GitFailure, Fallback>> = {
  [GitFailure.Diverged]: Fallback.Diverged,
  [GitFailure.BranchGone]: Fallback.BranchGone,
  [GitFailure.Forbidden]: Fallback.Protected
};

function refusedBeforeWrite(ask: PushAsk): PushRefused | null {
  const paths = ask.files.map((f) => f.path);
  if (!paths.length) {
    return { ok: false, refusal: PushRefusal.NoFiles };
  }
  const env = paths.filter(isEnvFile);
  if (env.length) {
    return { ok: false, refusal: PushRefusal.EnvFile, paths: env };
  }
  const secrets = withSecrets(ask.files);
  if (secrets.length) {
    return { ok: false, refusal: PushRefusal.Secret, paths: secrets };
  }
  const sensitive = paths.filter(isSensitive);
  return sensitive.length && !ask.confirmSensitive ? { ok: false, refusal: PushRefusal.NeedsConfirm, paths: sensitive } : null;
}

const headOrNull = (host: GitHost, branch: string) =>
  host.headOf(branch).catch((e: unknown) => {
    if (e instanceof GitError && e.failure === GitFailure.BranchGone) {
      return null;
    }
    throw e;
  });

const startBranch = (ask: PushAsk) => ask.since?.branch ?? sessionBranch(ask.name);

async function cycleBranch(host: GitHost, ask: PushAsk): Promise<string> {
  let branch = startBranch(ask);
  for (let last = await host.lastPull(branch); last && last.status !== PullStatus.Open; last = await host.lastPull(branch)) {
    branch = nextCycle(branch);
  }
  return branch;
}

async function commitOn(host: GitHost, branch: string, base: string, files: FileWrite[], message: string, since: string | null) {
  const head = await headOrNull(host, branch);
  if (!head && since) {
    throw new GitError(GitFailure.BranchGone, 0);
  }
  if (head && since && !(await host.isAncestor(since, head))) {
    throw new GitError(GitFailure.Diverged, 0);
  }
  const parent = head ?? (await host.headOf(base));
  const sha = await host.writeCommit({ parent, message, files });
  await (head ? host.moveBranch(branch, head, sha) : host.createBranch(branch, sha));
  return { sha, parent };
}

async function withLock<T>(lock: PushLock, key: string, work: () => Promise<T>): Promise<T | PushRefused> {
  if (!(await lock.acquire(key))) {
    return { ok: false, refusal: PushRefusal.Busy };
  }
  try {
    return await work();
  } catch (e) {
    if (e instanceof GitError) {
      return { ok: false, refusal: e.failure };
    }
    throw e;
  } finally {
    await lock.release(key);
  }
}

const openPullOf = async (host: GitHost, branch: string): Promise<PullRef | null> => {
  const last = await host.lastPull(branch);
  return last && last.status === PullStatus.Open ? { number: last.number, url: last.url } : null;
};

const refusalOf = (e: unknown): PushRefused => {
  if (e instanceof GitError && e.failure === GitFailure.Forbidden) {
    return { ok: false, refusal: PushRefusal.Protected };
  }
  if (e instanceof GitError) {
    return { ok: false, refusal: e.failure };
  }
  throw e;
};

async function overlapSince(host: GitHost, branch: string, since: string, head: string, paths: string[]): Promise<string[]> {
  if (since === head) {
    return [];
  }
  const theirs = new Set((await host.changedSince(since, branch)).map((f) => f.path));
  return paths.filter((p) => theirs.has(p));
}

async function commitWorking(host: GitHost, branch: string, base: string, ask: PushAsk): Promise<Pushed | PushRefused> {
  const touched = ask.files.map((f) => f.path);
  const head = await headOrNull(host, branch);
  const since = ask.since?.branch === branch ? ask.since.sha : null;
  const clash = head && since ? await overlapSince(host, branch, since, head, touched) : [];
  if (clash.length) {
    return { ok: false, refusal: PushRefusal.Conflict, paths: clash };
  }
  const parent = head ?? (await host.headOf(base));
  try {
    const sha = await host.writeCommit({ parent, message: messageOf(ask.title, ask.coAuthors ?? []), files: ask.files });
    await (head ? host.moveBranch(branch, head, sha) : host.createBranch(branch, sha));
    return { ok: true, branch, sha, parent, touched, pull: await openPullOf(host, branch).catch(() => null) };
  } catch (e) {
    return refusalOf(e);
  }
}

export async function saveWip(host: GitHost, lock: PushLock, ask: { branch: string; files: FileWrite[] }): Promise<Saved | PushRefused> {
  return withLock(lock, `${WIP_PREFIX}${ask.branch}`, async () => {
    const parent = await host.headOf(ask.branch);
    const sha = await host.writeCommit({ parent, message: WIP_MESSAGE, files: ask.files });
    const ref = `${WIP_PREFIX}${ask.branch}`;
    await host.setRef(ref, sha);
    return { ok: true, ref, sha } as Saved;
  });
}

export async function checkoutBranch(host: GitHost, ask: { branch: string; from?: string }): Promise<CheckedOut | PushRefused> {
  try {
    const head = await headOrNull(host, ask.branch);
    if (head) {
      return { ok: true, branch: ask.branch, head, created: false, pull: await openPullOf(host, ask.branch).catch(() => null) };
    }
    const from = await host.headOf(ask.from ?? (await host.defaultBranch()));
    await host.createBranch(ask.branch, from);
    return { ok: true, branch: ask.branch, head: from, created: true, pull: null };
  } catch (e) {
    return refusalOf(e);
  }
}

export async function openPull(host: GitHost, ask: PullAskOf): Promise<PullOpened | PushRefused> {
  if (ask.branch === ask.base) {
    return { ok: false, refusal: PushRefusal.SameBranch };
  }
  try {
    return { ok: true, pull: await host.upsertPull({ branch: ask.branch, base: ask.base, title: ask.title, body: ask.body, draft: ask.kind === PullKind.Draft }) };
  } catch (e) {
    return refusalOf(e);
  }
}

export async function readyPull(host: GitHost, number: number): Promise<Readied | PushRefused> {
  try {
    await host.markReady(number);
    return { ok: true, number };
  } catch (e) {
    if (e instanceof GitError) {
      return { ok: false, refusal: e.failure };
    }
    throw e;
  }
}

export async function pushFiles(host: GitHost, lock: PushLock, ask: PushAsk): Promise<Pushed | PushRefused> {
  const refused = refusedBeforeWrite(ask);
  if (refused) {
    return refused;
  }

  return withLock(lock, ask.branch ?? startBranch(ask), async () => {
    if ((await host.access()) === Access.Read) {
      return { ok: false, refusal: PushRefusal.ReadOnly } as PushRefused;
    }
    const base = ask.base ?? (await host.defaultBranch());
    if (ask.branch) {
      return commitWorking(host, ask.branch, base, ask);
    }
    const branch = await cycleBranch(host, ask.since?.branch === base ? { ...ask, since: undefined } : ask);
    const since = ask.since?.branch === branch ? ask.since.sha : null;
    const message = messageOf(ask.title, ask.coAuthors ?? []);
    const touched = ask.files.map((f) => f.path);
    const landed = await commitOn(host, branch, base, ask.files, message, since).then(
      (done) => ({ ...done, branch, fallback: undefined as Fallback | undefined }),
      async (e: unknown) => {
        const fallback = e instanceof GitError ? FALLBACK_OF[e.failure] : undefined;
        if (!fallback) {
          throw e;
        }
        const sync = `${branch}${SYNC_SUFFIX}`;
        return { ...(await commitOn(host, sync, base, ask.files, message, null)), branch: sync, fallback };
      }
    );
    const pull = await host.upsertPull({ branch: landed.branch, base, title: ask.title, body: ask.body, draft: false }).catch((e: unknown) => {
      if (e instanceof GitError && e.failure === GitFailure.PullUnavailable) {
        return null;
      }
      throw e;
    });
    return { ok: true, branch: landed.branch, sha: landed.sha, parent: landed.parent, touched, pull, ...(landed.fallback ? { fallback: landed.fallback } : {}) } as Pushed;
  });
}

export async function undoPush(host: GitHost, lock: PushLock, ask: { branch: string; parent: string; paths: string[] }): Promise<Undone | PushRefused> {
  return withLock(lock, ask.branch, async () => {
    const files = await Promise.all(ask.paths.map(async (path) => ({ path, content: await host.readFile(path, ask.parent) })));
    const head = await host.headOf(ask.branch);
    const sha = await host.writeCommit({ parent: head, message: UNDO_TITLE, files });
    await host.moveBranch(ask.branch, head, sha);
    return { ok: true, branch: ask.branch, sha } as Undone;
  });
}

export async function pushStatus(host: GitHost, ask: { branch: string; sha: string; baseSha: string; base?: string }): Promise<PushState | PushRefused> {
  try {
    const base = ask.base ?? (await host.defaultBranch());
    const head = await host.headOf(ask.branch);
    const diverged = !(await host.isAncestor(ask.sha, head));
    const upstream = await host.changedSince(ask.baseSha, base);
    const last = await host.lastPull(ask.branch);
    return { ok: true, branch: ask.branch, head, diverged, upstream, pull: last ? await host.pull(last.number) : null };
  } catch (e) {
    if (e instanceof GitError) {
      return { ok: false, refusal: e.failure };
    }
    throw e;
  }
}
