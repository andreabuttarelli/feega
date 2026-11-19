import { GitError, type GitHost } from './git-host';
import type { PushLock } from './push-lock';

export enum HistoryRefusal {
  Conflict = 'conflict',
  Busy = 'busy',
  NoParent = 'no_parent'
}

export type FileDiff = { path: string; before: string | null; after: string | null };

export type Diffed = { ok: true; files: FileDiff[] };

export type Reverted = { ok: true; branch: string; sha: string };

export type HistoryRefused = { ok: false; refusal: HistoryRefusal | string; paths?: string[] };

const REVERT_PREFIX = 'Revert';

const refusedBy = (e: unknown): HistoryRefused => {
  if (e instanceof GitError) {
    return { ok: false, refusal: e.failure };
  }
  throw e;
};

async function parentOf(host: GitHost, sha: string): Promise<string | null> {
  return (await host.listCommits(sha, { limit: 2 }))[1]?.sha ?? null;
}

async function diffBetween(host: GitHost, from: string, to: string): Promise<FileDiff[]> {
  const changed = await host.changedSince(from, to);
  return Promise.all(changed.map(async (f) => ({ path: f.path, before: await host.readFile(f.from ?? f.path, from), after: await host.readFile(f.path, to) })));
}

export async function commitDiff(host: GitHost, sha: string): Promise<Diffed | HistoryRefused> {
  try {
    const parent = await parentOf(host, sha);
    return parent ? { ok: true, files: await diffBetween(host, parent, sha) } : { ok: false, refusal: HistoryRefusal.NoParent };
  } catch (e) {
    return refusedBy(e);
  }
}

export async function branchDiff(host: GitHost, ask: { branch: string; base: string }): Promise<Diffed | HistoryRefused> {
  try {
    return { ok: true, files: await diffBetween(host, await host.headOf(ask.base), ask.branch) };
  } catch (e) {
    return refusedBy(e);
  }
}

export async function revertCommit(host: GitHost, lock: PushLock, ask: { branch: string; sha: string }): Promise<Reverted | HistoryRefused> {
  if (!(await lock.acquire(ask.branch))) {
    return { ok: false, refusal: HistoryRefusal.Busy };
  }
  try {
    const parent = await parentOf(host, ask.sha);
    if (!parent) {
      return { ok: false, refusal: HistoryRefusal.NoParent };
    }
    const touched = (await host.changedSince(parent, ask.sha)).map((f) => f.path);
    const head = await host.headOf(ask.branch);
    const later = new Set(head === ask.sha ? [] : (await host.changedSince(ask.sha, ask.branch)).map((f) => f.path));
    const clash = touched.filter((p) => later.has(p));
    if (clash.length) {
      return { ok: false, refusal: HistoryRefusal.Conflict, paths: clash };
    }
    const subject = (await host.listCommits(ask.sha, { limit: 1 }))[0]?.message ?? ask.sha.slice(0, 7);
    const files = await Promise.all(touched.map(async (path) => ({ path, content: await host.readFile(path, parent) })));
    const sha = await host.writeCommit({ parent: head, message: `${REVERT_PREFIX} "${subject}"\n\nThis reverts commit ${ask.sha}.`, files });
    await host.moveBranch(ask.branch, head, sha);
    return { ok: true, branch: ask.branch, sha };
  } catch (e) {
    return refusedBy(e);
  } finally {
    await lock.release(ask.branch);
  }
}
