import type { CodeScope } from '$lib/server/code-import/canvas-import';
import { SyncOutcome, type CodeEdits, type SyncRefusal } from '$lib/server/code-import/code-sync';
import { EditTarget, type PropProposal } from '$lib/server/code-import/instance-edits';
import { Access, GitError, GitFailure, PullStatus, type GitHost } from './git-host';
import { CodeSourceKind, EntryKind, followRenames, isPushable, linkStatus, type CodeLink, type LinkState } from './link';
import type { LinkStore } from './link-store';
import type { PushLock } from './push-lock';
import { relocated, suggestedRoute, VariantChoice, type Suggested, type VariantAsk } from './variants';
import { checkoutBranch, openPull, PullKind, PushRefusal, pushFiles, pushStatus, readyPull, saveWip, undoPush, type CheckedOut, type LastPush, type PullOpened, type PushRefused, type PushState, type Pushed, type Readied, type Saved, type Undone } from './push';

export enum FramesRefusal {
  NotConnected = 'not_connected',
  NotPushable = 'not_pushable',
  ManyRepos = 'many_repos',
  NotLinked = 'not_linked',
  NotPushed = 'not_pushed',
  VariantChoice = 'variant_choice',
  NoBranch = 'no_branch'
}

export type FramesRefused = { ok: false; refusal: FramesRefusal | SyncRefusal | PushRefused['refusal']; paths?: string[]; patch?: { path: string; content: string }[]; suggested?: Suggested[] };

export type FramesDeps = {
  host: (source: CodeSourceKind, repo: string) => Promise<GitHost | null>;
  edits: (scope: CodeScope, nodeId: string, target?: EditTarget) => Promise<CodeEdits | SyncRefusal>;
  links: LinkStore;
  lock: PushLock;
};

export type FramesPushAsk = { name: string; nodeIds: string[]; title?: string; body?: string; since?: LastPush; base?: string; coAuthors?: string[]; confirmSensitive?: boolean; mains?: string[]; variants?: VariantAsk[] };

export type Affected = { path: string; pages: number };

export type FrameStatus = { ok: true; state: LinkState; link: CodeLink; push: PushState | null; affected: Affected[]; proposals: PropProposal[] };

const DEFAULT_TITLE = 'UI edits from Feega';
const DEFAULT_BODY = 'Edited on the Feega canvas.';

const refused = (refusal: FramesRefused['refusal']): FramesRefused => ({ ok: false, refusal });

const targetOf = (mains: string[] | undefined, nodeId: string) => (mains?.includes(nodeId) ? EditTarget.Main : EditTarget.Instance);

type Shape = (nodeId: string, files: CodeEdits['files']) => CodeEdits['files'];

const asIs: Shape = (_nodeId, files) => files;

async function frameEdits(deps: Pick<FramesDeps, 'edits' | 'links'>, scope: CodeScope, nodeId: string, target?: EditTarget): Promise<CodeEdits | SyncRefusal> {
  const [got, link] = await Promise.all([deps.edits(scope, nodeId, target), deps.links.read(nodeId)]);
  const restored = link?.restored ?? [];
  if (!link || !restored.length || (typeof got === 'string' && got !== SyncOutcome.NoChanges)) {
    return got;
  }
  const base = typeof got === 'string' ? { repo: link.repo, kind: link.source, files: [], skipped: [] } : got;
  const byPath = new Map([...base.files, ...restored].map((f) => [f.path, f]));
  return { ...base, files: [...byPath.values()] };
}

async function editsOf(deps: FramesDeps, scope: CodeScope, nodeIds: string[], mains?: string[], shape: Shape = asIs): Promise<{ source: CodeSourceKind; repo: string; files: { path: string; content: string }[] } | FramesRefused> {
  const all: CodeEdits[] = [];
  for (const nodeId of nodeIds) {
    const got = await frameEdits(deps, scope, nodeId, targetOf(mains, nodeId));
    if (typeof got === 'string') {
      return refused(got);
    }
    all.push({ ...got, files: shape(nodeId, got.files) });
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

type Planned = { nodeIds: string[]; shape: Shape };

async function variantPlan(deps: FramesDeps, ask: FramesPushAsk): Promise<Planned | FramesRefused> {
  const primary = await Promise.all(ask.nodeIds.map(async (nodeId) => ({ nodeId, link: await deps.links.read(nodeId) })));
  const variants = primary.filter((p) => p.link?.variantOf);
  const choiceOf = new Map((ask.variants ?? []).map((v) => [v.nodeId, v]));
  const unanswered = variants.filter((v) => !choiceOf.has(v.nodeId));
  if (unanswered.length) {
    return { ...refused(FramesRefusal.VariantChoice), suggested: unanswered.map((v) => ({ nodeId: v.nodeId, route: suggestedRoute(v.link!.route) })) };
  }

  const linkOf = new Map(primary.map((p) => [p.nodeId, p.link]));
  const nodeIds = ask.nodeIds.filter((id) => choiceOf.get(id)?.choice !== VariantChoice.Keep || !linkOf.get(id)?.variantOf);
  const shape: Shape = (nodeId, files) => {
    const asked = choiceOf.get(nodeId);
    const link = linkOf.get(nodeId);
    return asked?.choice === VariantChoice.NewRoute && link?.variantOf ? relocated(link, asked.route ?? suggestedRoute(link.route), files) : files;
  };
  return { nodeIds, shape };
}

export async function framesPush(deps: FramesDeps, scope: CodeScope, ask: FramesPushAsk): Promise<Pushed | FramesRefused> {
  const plan = await variantPlan(deps, ask);
  if ('ok' in plan) {
    return plan;
  }
  if (!plan.nodeIds.length) {
    return refused(PushRefusal.NoFiles);
  }
  const edits = await editsOf(deps, scope, plan.nodeIds, ask.mains, plan.shape);
  if ('ok' in edits) {
    return edits;
  }
  const host = await deps.host(edits.source, edits.repo);
  if (!host) {
    return refused(FramesRefusal.NotConnected);
  }

  const links = await Promise.all(ask.nodeIds.map(async (nodeId) => ({ nodeId, link: await deps.links.read(nodeId) })));
  const since = ask.since ?? lastPushOf(links[0]?.link ?? null);
  const branch = links.find((l) => l.link?.workBranch)?.link?.workBranch;
  const out = await pushFiles(host, deps.lock, { name: ask.name, files: edits.files, title: ask.title ?? DEFAULT_TITLE, body: ask.body ?? DEFAULT_BODY, since, base: ask.base, coAuthors: ask.coAuthors, confirmSensitive: ask.confirmSensitive, branch });
  if (!out.ok) {
    return out.refusal === PushRefusal.ReadOnly ? { ...out, patch: edits.files } : out;
  }

  const pushed = { pushBranch: out.branch, pushSha: out.sha, pushParent: out.parent, pushTouched: out.touched, pullNumber: out.pull?.number };
  const every = (await Promise.all(ask.nodeIds.map(async (nodeId) => (await deps.links.all(nodeId)).map((link) => ({ nodeId, link }))))).flat();
  await Promise.all(every.map((l) => deps.links.save(l.nodeId, { ...l.link, ...pushed, ...(l.link.restored ? { restored: [] } : {}) })));
  return out;
}

const SINGLE_PAGE = 1;

export function affectedBy(links: CodeLink[], modified: string[], appRoot: string): Affected[] {
  const pages = links.filter((l) => l.entryKind === EntryKind.Page && l.appRoot === appRoot);
  const inApp = (path: string) => (appRoot ? path.slice(appRoot.replace(/\/$/, '').length + 1) : path);
  return modified.map((path) => ({ path, pages: pages.filter((l) => l.files.includes(inApp(path))).length })).filter((a) => a.pages > SINGLE_PAGE);
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
  const upstream = writable ? await host.changedSince(stored.keptSha ?? stored.baseSha, stored.baseBranch) : [];
  const link = followRenames(stored, upstream);
  if (link.entry !== stored.entry || link.files.join() !== stored.files.join()) {
    await deps.links.save(nodeId, link);
  }
  const edits = await frameEdits(deps, scope, nodeId);
  const modified = typeof edits === 'string' ? [] : edits.files.map((f) => f.path);
  const affected = affectedBy(await deps.links.inProject(), modified, link.appRoot);
  const push = writable && link.pushBranch && link.pushSha ? await pushStatus(host, { branch: link.pushBranch, sha: link.pushSha, baseSha: link.baseSha, base: link.baseBranch }) : null;
  const state = push && push.ok ? push : null;
  const inPull = state?.pull?.status === PullStatus.Open;
  return { ok: true, state: linkStatus({ link, upstream, modified, writable, inPull }), link, push: state, affected, proposals: typeof edits === 'string' ? [] : (edits.proposals ?? []) };
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

export async function frameReady(deps: FramesDeps, nodeId: string): Promise<Readied | FramesRefused> {
  const link = await deps.links.read(nodeId);
  if (!link) {
    return refused(FramesRefusal.NotLinked);
  }
  if (!link.pullNumber) {
    return refused(FramesRefusal.NotPushed);
  }
  const host = await deps.host(link.source, link.repo);
  return host ? readyPull(host, link.pullNumber) : refused(FramesRefusal.NotConnected);
}

type Linked = { nodeId: string; link: CodeLink };

async function linkedHost(deps: FramesDeps, nodeId: string): Promise<{ link: CodeLink; host: GitHost } | FramesRefused> {
  const link = await deps.links.read(nodeId);
  if (!link) {
    return refused(FramesRefusal.NotLinked);
  }
  const host = await deps.host(link.source, link.repo);
  return host ? { link, host } : refused(FramesRefusal.NotConnected);
}

async function saveAll(deps: FramesDeps, nodeIds: string[], patch: Partial<CodeLink>) {
  const every: Linked[] = (await Promise.all(nodeIds.map(async (nodeId) => (await deps.links.all(nodeId)).map((link) => ({ nodeId, link }))))).flat();
  await Promise.all(every.map((l) => deps.links.save(l.nodeId, { ...l.link, ...patch })));
}

export async function frameCheckout(deps: FramesDeps, ask: { nodeIds: string[]; branch: string; from?: string }): Promise<CheckedOut | FramesRefused> {
  const got = await linkedHost(deps, ask.nodeIds[0]);
  if ('ok' in got) {
    return got;
  }
  const out = await checkoutBranch(got.host, { branch: ask.branch, from: ask.from ?? got.link.baseBranch });
  if (out.ok) {
    await saveAll(deps, ask.nodeIds, { workBranch: out.branch, pushBranch: out.branch, pushSha: out.head, pullNumber: out.pull?.number });
  }
  return out;
}

export async function frameWip(deps: FramesDeps, scope: CodeScope, nodeIds: string[]): Promise<Saved | FramesRefused> {
  const link = await deps.links.read(nodeIds[0]);
  if (!link) {
    return refused(FramesRefusal.NotLinked);
  }
  if (!link.workBranch) {
    return refused(FramesRefusal.NoBranch);
  }
  const edits = await editsOf(deps, scope, nodeIds);
  if ('ok' in edits) {
    return edits;
  }
  const host = await deps.host(edits.source, edits.repo);
  return host ? saveWip(host, deps.lock, { branch: link.workBranch, files: edits.files }) : refused(FramesRefusal.NotConnected);
}

export async function framePull(deps: FramesDeps, ask: { nodeId: string; base?: string; title?: string; body?: string; kind?: PullKind }): Promise<PullOpened | FramesRefused> {
  const got = await linkedHost(deps, ask.nodeId);
  if ('ok' in got) {
    return got;
  }
  const branch = got.link.workBranch ?? got.link.pushBranch;
  if (!branch) {
    return refused(FramesRefusal.NoBranch);
  }
  const out = await openPull(got.host, { branch, base: ask.base ?? (await got.host.defaultBranch()), title: ask.title ?? DEFAULT_TITLE, body: ask.body ?? DEFAULT_BODY, kind: ask.kind ?? PullKind.Draft });
  if (out.ok) {
    await saveAll(deps, [ask.nodeId], { pullNumber: out.pull.number });
  }
  return out;
}

const HTTP_STATUS: Record<string, number> = {
  [FramesRefusal.NotConnected]: 409,
  [FramesRefusal.NotPushable]: 409,
  [FramesRefusal.ManyRepos]: 400,
  [FramesRefusal.NotLinked]: 404,
  [FramesRefusal.NotPushed]: 409,
  [FramesRefusal.VariantChoice]: 409,
  [PushRefusal.ReadOnly]: 403,
  [PushRefusal.EnvFile]: 422,
  [PushRefusal.Secret]: 422,
  [PushRefusal.NeedsConfirm]: 428,
  [PushRefusal.NoFiles]: 409,
  [PushRefusal.Busy]: 423,
  [PushRefusal.Protected]: 403,
  [PushRefusal.Conflict]: 409,
  [PushRefusal.SameBranch]: 400,
  [FramesRefusal.NoBranch]: 409,
  [GitFailure.BranchGone]: 409,
  [GitFailure.Diverged]: 409,
  [GitFailure.Unauthorized]: 401,
  [GitFailure.Forbidden]: 403,
  [GitFailure.NotFound]: 404,
  [GitFailure.Unexpected]: 502
};

const CONFLICT = 409;

export const httpStatusOf = (refusal: string) => HTTP_STATUS[refusal] ?? CONFLICT;

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
  await Promise.all((await deps.links.all(nodeId)).map((l) => deps.links.save(nodeId, { ...l, baseSha, keptSha: undefined })));
  return { ...link, baseSha };
}
