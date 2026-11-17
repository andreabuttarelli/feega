import type { CodeScope } from '$lib/server/code-import/canvas-import';
import type { CodeEdits, SyncRefusal } from '$lib/server/code-import/code-sync';
import { Access, GitError, GitFailure, PullStatus, type GitHost } from './git-host';
import { CodeSourceKind, followRenames, isPushable, linkStatus, type CodeLink, type LinkState } from './link';
import type { LinkStore } from './link-store';
import type { PushLock } from './push-lock';
import { PushRefusal, pushFiles, pushStatus, undoPush, type LastPush, type PushRefused, type PushState, type Pushed, type Undone } from './push';

export enum FramesRefusal {
  NotConnected = 'not_connected',
  NotPushable = 'not_pushable',
  ManyRepos = 'many_repos',
  NotLinked = 'not_linked',
  NotPushed = 'not_pushed'
}

export type FramesRefused = { ok: false; refusal: FramesRefusal | SyncRefusal | PushRefused['refusal']; paths?: string[]; patch?: { path: string; content: string }[] };

export type FramesDeps = {
  host: (source: CodeSourceKind, repo: string) => Promise<GitHost | null>;
  edits: (scope: CodeScope, nodeId: string) => Promise<CodeEdits | SyncRefusal>;
  links: LinkStore;
  lock: PushLock;
};

export type FramesPushAsk = { name: string; nodeIds: string[]; title?: string; body?: string; since?: LastPush; base?: string; coAuthors?: string[]; confirmSensitive?: boolean };

export type FrameStatus = { ok: true; state: LinkState; link: CodeLink; push: PushState | null };

const DEFAULT_TITLE = 'UI edits from Feega';
const DEFAULT_BODY = 'Edited on the Feega canvas.';

const refused = (refusal: FramesRefused['refusal']): FramesRefused => ({ ok: false, refusal });

async function editsOf(deps: FramesDeps, scope: CodeScope, nodeIds: string[]): Promise<{ source: CodeSourceKind; repo: string; files: { path: string; content: string }[] } | FramesRefused> {
  const all: CodeEdits[] = [];
  for (const nodeId of nodeIds) {
    const got = await deps.edits(scope, nodeId);
    if (typeof got === 'string') {
      return refused(got);
    }
    all.push(got);
  }
  if (all.some((e) => !isPushable(e.kind))) {
    return refused(FramesRefusal.NotPushable);
  }
  const repos = new Set(all.map((e) => `${e.kind}:${e.repo}`));
  if (repos.size !== 1) {
    return refused(FramesRefusal.ManyRepos);
  }
  const byPath = new Map(all.flatMap((e) => e.files).map((f) => [f.path, f]));
  return { source: all[0].kind as CodeSourceKind, repo: all[0].repo, files: [...byPath.values()] };
}

const lastPushOf = (link: CodeLink | null): LastPush | undefined => (link?.pushBranch && link.pushSha ? { branch: link.pushBranch, sha: link.pushSha } : undefined);

export async function framesPush(deps: FramesDeps, scope: CodeScope, ask: FramesPushAsk): Promise<Pushed | FramesRefused> {
  const edits = await editsOf(deps, scope, ask.nodeIds);
  if ('ok' in edits) {
    return edits;
  }
  const host = await deps.host(edits.source, edits.repo);
  if (!host) {
    return refused(FramesRefusal.NotConnected);
  }

  const links = await Promise.all(ask.nodeIds.map(async (nodeId) => ({ nodeId, link: await deps.links.read(nodeId) })));
  const since = ask.since ?? lastPushOf(links[0]?.link ?? null);
  const out = await pushFiles(host, deps.lock, { name: ask.name, files: edits.files, title: ask.title ?? DEFAULT_TITLE, body: ask.body ?? DEFAULT_BODY, since, base: ask.base, coAuthors: ask.coAuthors, confirmSensitive: ask.confirmSensitive });
  if (!out.ok) {
    return out.refusal === PushRefusal.ReadOnly ? { ...out, patch: edits.files } : out;
  }

  const pushed = { pushBranch: out.branch, pushSha: out.sha, pushParent: out.parent, pushTouched: out.touched, pullNumber: out.pull?.number };
  const every = (await Promise.all(ask.nodeIds.map(async (nodeId) => (await deps.links.all(nodeId)).map((link) => ({ nodeId, link }))))).flat();
  await Promise.all(every.map((l) => deps.links.save(l.nodeId, { ...l.link, ...pushed })));
  return out;
}

async function writableOn(host: GitHost, link: CodeLink): Promise<boolean> {
  if (!link.writable) {
    return false;
  }
  return host.access().then(
    (access) => access === Access.Write,
    (e: unknown) => {
      if (e instanceof GitError && (e.failure === GitFailure.Unauthorized || e.failure === GitFailure.Forbidden)) {
        return false;
      }
      throw e;
    }
  );
}

export async function frameStatus(deps: FramesDeps, scope: CodeScope, nodeId: string): Promise<FrameStatus | FramesRefused> {
  const stored = await deps.links.read(nodeId);
  if (!stored) {
    return refused(FramesRefusal.NotLinked);
  }
  const host = await deps.host(stored.source, stored.repo);
  if (!host) {
    return refused(FramesRefusal.NotConnected);
  }

  const writable = await writableOn(host, stored);
  const upstream = writable ? await host.changedSince(stored.baseSha, stored.baseBranch) : [];
  const link = followRenames(stored, upstream);
  if (link.entry !== stored.entry || link.files.join() !== stored.files.join()) {
    await deps.links.save(nodeId, link);
  }
  const edits = await deps.edits(scope, nodeId);
  const modified = typeof edits === 'string' ? [] : edits.files.map((f) => f.path);
  const push = writable && link.pushBranch && link.pushSha ? await pushStatus(host, { branch: link.pushBranch, sha: link.pushSha, baseSha: link.baseSha, base: link.baseBranch }) : null;
  const state = push && push.ok ? push : null;
  const inPull = state?.pull?.status === PullStatus.Open;
  return { ok: true, state: linkStatus({ link, upstream, modified, writable, inPull }), link, push: state };
}

export async function frameUndo(deps: FramesDeps, nodeId: string): Promise<Undone | FramesRefused> {
  const link = await deps.links.read(nodeId);
  if (!link) {
    return refused(FramesRefusal.NotLinked);
  }
  if (!link.pushBranch || !link.pushParent || !link.pushTouched?.length) {
    return refused(FramesRefusal.NotPushed);
  }
  const host = await deps.host(link.source, link.repo);
  return host ? undoPush(host, deps.lock, { branch: link.pushBranch, parent: link.pushParent, paths: link.pushTouched }) : refused(FramesRefusal.NotConnected);
}

const HTTP_STATUS: Record<string, number> = {
  [FramesRefusal.NotConnected]: 409,
  [FramesRefusal.NotPushable]: 409,
  [FramesRefusal.ManyRepos]: 400,
  [FramesRefusal.NotLinked]: 404,
  [FramesRefusal.NotPushed]: 409,
  [PushRefusal.ReadOnly]: 403,
  [PushRefusal.EnvFile]: 422,
  [PushRefusal.Secret]: 422,
  [PushRefusal.NeedsConfirm]: 428,
  [PushRefusal.NoFiles]: 409,
  [PushRefusal.Busy]: 423,
  [GitFailure.BranchGone]: 409,
  [GitFailure.Diverged]: 409,
  [GitFailure.Unauthorized]: 401,
  [GitFailure.Forbidden]: 403,
  [GitFailure.NotFound]: 404,
  [GitFailure.Unexpected]: 502
};

const CONFLICT = 409;

export const httpStatusOf = (refusal: FramesRefused['refusal']) => HTTP_STATUS[refusal] ?? CONFLICT;

export async function frameDetach(deps: Pick<FramesDeps, 'links'>, nodeId: string): Promise<{ ok: true } | FramesRefused> {
  return (await deps.links.remove(nodeId)) ? { ok: true } : refused(FramesRefusal.NotLinked);
}

export async function frameRebased(deps: Pick<FramesDeps, 'host' | 'links'>, nodeId: string): Promise<CodeLink | null> {
  const link = await deps.links.read(nodeId);
  const host = link ? await deps.host(link.source, link.repo) : null;
  if (!link || !host) {
    return null;
  }
  const baseSha = await host.headOf(link.baseBranch);
  await Promise.all((await deps.links.all(nodeId)).map((l) => deps.links.save(nodeId, { ...l, baseSha })));
  return { ...link, baseSha };
}
