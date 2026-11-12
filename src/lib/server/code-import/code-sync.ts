import { env } from '$env/dynamic/private';
import { codeOriginSchema, type CodeOriginData } from '$lib/canvas/motion-node';
import { findNode } from '$lib/server/repos/canvas';
import { frameStore } from '$lib/server/motion/move-element';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { localModeRefusal } from '$lib/server/local/local-mode';
import { githubFor } from './github-runtime';
import { repoOf } from './repo';
import { rebased, tokenCall } from './repo-sync';
import { baselined } from '$lib/canvas/code-look';
import { patchOf, type FileChange } from './write-back';
import { frameEdits } from './token-write';
import { pulledTokens } from './token-pull';
import type { TokenMap } from './design-tokens';
import { CodeImportOutcome } from './import-code';
import { importCodeInto, rememberOrigin, type CodeImportAsk, type CodeScope } from './canvas-import';
import { githubSource, SourceKind, type CodeSource, type GithubCalls } from './code-source';
import { folderOf, folderSource } from './folder-source';
import { uploadedArchive, uploadOf, uploadSource } from './upload-source';
import { BASE_CONDITIONS, conditionsOf, labelOf, type RenderConditions, type Variant } from './render-conditions';
import { addBoards, AddRefusal } from '$lib/canvas/code-boards';
import { boardsUsed, condOf, MAX_FRAME_BOARDS, mergedMap, type ImportMap } from '$lib/canvas/import-map';
import { routesFound } from './canvas-import';
import { mapOf } from './import-map-of';
import { UNREADABLE, type RoutesFound } from './routes-found';
import type { MotionDoc } from '@feega/motion-core/motion/doc';

export enum SyncOutcome {
  Ok = 'ok',
  NotFromCode = 'not_from_code',
  NoChanges = 'no_changes',
  NoGithub = 'no_github',
  PublishFailed = 'publish_failed',
  UpToDate = 'up_to_date',
  Unreachable = 'unreachable',
  Conflict = 'conflict',
  NoSync = 'no_sync',
  FrameFull = 'frame_full'
}

export type SyncRefusal = Exclude<SyncOutcome, SyncOutcome.Ok | SyncOutcome.UpToDate>;

export const SYNC_STATUS: Record<SyncRefusal, number> = {
  [SyncOutcome.NotFromCode]: 404,
  [SyncOutcome.NoChanges]: 409,
  [SyncOutcome.NoGithub]: 412,
  [SyncOutcome.PublishFailed]: 502,
  [SyncOutcome.Unreachable]: 502,
  [SyncOutcome.Conflict]: 409,
  [SyncOutcome.NoSync]: 409,
  [SyncOutcome.FrameFull]: 409
};

const UNPUBLISHED: Record<SourceKind, SyncRefusal> = {
  [SourceKind.Github]: SyncOutcome.NoGithub,
  [SourceKind.Folder]: SyncOutcome.PublishFailed,
  [SourceKind.Upload]: SyncOutcome.NoSync
};

type Linked = { origin: CodeOriginData; source: CodeSource; link: (rev: string) => Pick<CodeImportAsk, 'repo' | 'folder' | 'upload'> };

const BRANCH_PREFIX = 'feega/';
const TITLE = 'UI edits from feega';

async function githubCalls(scope: CodeScope): Promise<GithubCalls> {
  const own = await githubFor(scope.db, scope).call().catch(() => null);
  return { read: own ?? (env.GITHUB_TOKEN ? tokenCall(env.GITHUB_TOKEN) : null), write: own };
}

type SourceOf = (scope: CodeScope, origin: CodeOriginData) => Promise<Linked | null>;

const SOURCES: Record<SourceKind, SourceOf> = {
  [SourceKind.Github]: async (scope, origin) => {
    const ref = repoOf(`https://github.com/${origin.repo}`);
    return ref ? { origin, source: githubSource(ref, await githubCalls(scope)), link: (rev) => ({ repo: `https://github.com/${origin.repo}/tree/${rev}` }) } : null;
  },
  [SourceKind.Folder]: async (_scope, origin) => {
    const root = localModeRefusal(env) === null ? folderOf(origin.repo) : null;
    return root ? { origin, source: folderSource(root), link: () => ({ folder: root }) } : null;
  },
  [SourceKind.Upload]: async (scope, origin) => {
    const upload = uploadOf(scope.orgId, origin.repo);
    const archive = upload ? await uploadedArchive(scope.db, upload) : null;
    return upload && archive ? { origin, source: uploadSource(archive), link: () => ({ upload: upload.path }) } : null;
  }
};

async function linkedOf(scope: CodeScope, nodeId: string): Promise<Linked | null> {
  const node = await findNode(scope.db, { orgId: scope.orgId, nodeId });
  const parsed = node && node.projectId === scope.projectId ? codeOriginSchema.safeParse(node.data.code) : null;
  return parsed?.success ? SOURCES[parsed.data.kind as SourceKind](scope, parsed.data) : null;
}

type Changed = { linked: Linked; rev: string; files: FileChange[]; skipped: string[]; tokens: TokenMap };

async function changed(scope: CodeScope, nodeId: string): Promise<Changed | SyncRefusal> {
  const linked = await linkedOf(scope, nodeId);
  const frame = linked ? await frameStore(scope.db, scope).read(nodeId) : null;
  if (!linked || !frame) {
    return SyncOutcome.NotFromCode;
  }
  const rev = linked.origin.sha ?? (await linked.source.head(linked.origin.branch));
  if (!rev) {
    return SyncOutcome.Unreachable;
  }
  const done = await frameEdits(frame.doc, linked.origin.tokens, linked.source.read(rev));
  return { linked, rev, files: done.files, skipped: done.skipped, tokens: done.map };
}

export type CodeChanges = { outcome: SyncOutcome.Ok; kind: string; repo: string; sha: string; patch: string; files: string[]; skipped: string[] };

export async function codeChanges(scope: CodeScope, nodeId: string): Promise<CodeChanges | { outcome: SyncRefusal }> {
  const done = await changed(scope, nodeId);
  if (typeof done === 'string') {
    return { outcome: done };
  }
  return { outcome: SyncOutcome.Ok, kind: done.linked.origin.kind, repo: done.linked.origin.repo, sha: done.rev, patch: patchOf(done.files), files: done.files.map((f) => f.path), skipped: done.skipped };
}

export type CodePublished = { outcome: SyncOutcome.Ok; url: string | null; branch: string | null; files: string[]; skipped: string[] };

export async function codePublish(scope: CodeScope, nodeId: string, now = Date.now()): Promise<CodePublished | { outcome: SyncRefusal }> {
  const done = await changed(scope, nodeId);
  if (typeof done === 'string') {
    return { outcome: done };
  }
  if (!done.files.length) {
    return { outcome: SyncOutcome.NoChanges };
  }
  const branch = `${BRANCH_PREFIX}${nodeId.slice(0, 8)}-${now.toString(36)}`;
  const notes = done.skipped.length ? `\n\nNot written back:\n${done.skipped.map((s) => `- ${s}`).join('\n')}` : '';
  const body = `Edited on the feega canvas, from ${done.linked.origin.repo}@${done.rev.slice(0, 7)}.${notes}`;
  const out = await done.linked.source.publish(done.rev, done.files, { branch, title: TITLE, body });
  if (!out) {
    return { outcome: UNPUBLISHED[done.linked.origin.kind as SourceKind] };
  }
  if (done.linked.origin.kind === SourceKind.Folder) {
    await settle(scope, nodeId, done.linked, done.tokens);
  }
  return { outcome: SyncOutcome.Ok, ...out, skipped: done.skipped };
}

async function settle(scope: CodeScope, nodeId: string, linked: Linked, tokens: TokenMap): Promise<void> {
  const store = frameStore(scope.db, scope);
  const frame = await store.read(nodeId);
  if (frame) {
    await store.write(nodeId, frame.version, baselined(frame.doc), 'Wrote edits to the folder');
  }
  const written = linked.origin.tokens ? { tokens } : {};
  await rememberOrigin(scope, nodeId, { ...linked.origin, ...written, sha: await linked.source.head(null) });
}

export type CodePulled = { outcome: SyncOutcome.Ok | SyncOutcome.UpToDate; sha: string; carried: number; conflicts: string[]; skipped: string[]; tokens: string[] };

export async function codePull(scope: CodeScope, nodeId: string, branch?: string): Promise<CodePulled | { outcome: SyncRefusal; error?: string }> {
  const linked = await linkedOf(scope, nodeId);
  const store = frameStore(scope.db, scope);
  const local = linked ? await store.read(nodeId) : null;
  if (!linked || !local) {
    return { outcome: SyncOutcome.NotFromCode };
  }
  const target = branch ?? linked.origin.branch;
  const rev = await linked.source.head(target);
  if (!rev) {
    return { outcome: SyncOutcome.Unreachable };
  }
  if (rev === linked.origin.sha) {
    return { outcome: SyncOutcome.UpToDate, sha: rev, carried: 0, conflicts: [], skipped: [], tokens: [] };
  }

  const origin = linked.origin;
  const [fresh, listed] = await Promise.all([
    importCodeInto(scope, local.canvasId, { ...linked.link(rev), app: origin.app, routes: origin.routes, conditions: conditionsOf(origin.conditions), variants: pulledVariants(origin), delay: origin.delay, at: local.at ?? { x: 0, y: 0 } }),
    routesFound(scope, { ...WHERE[origin.kind as SourceKind](origin), app: origin.app }).catch(() => null)
  ]);
  if (fresh.outcome !== CodeImportOutcome.Ok) {
    return { outcome: SyncOutcome.Unreachable, error: fresh.error ?? fresh.outcome };
  }
  const upstream = await store.read(fresh.frameId);
  await store.remove(fresh.frameId);
  if (!upstream) {
    return { outcome: SyncOutcome.Unreachable };
  }

  const merged = rebased(local.doc, upstream.doc);
  const tokens = linked.origin.tokens && fresh.tokenMap ? pulledTokens({ doc: local.doc, map: linked.origin.tokens }, { doc: merged.doc, map: fresh.tokenMap }) : null;
  const written = await store.write(nodeId, local.version, tokens?.doc ?? merged.doc, `Pulled ${linked.origin.repo}@${rev.slice(0, 7)}`);
  if (written.outcome !== RevisionOutcome.Written) {
    return { outcome: SyncOutcome.Conflict };
  }
  const map = mapOf(listed ?? NOT_LISTED, fresh, { asked: origin.routes, rev });
  await rememberOrigin(scope, nodeId, { ...origin, branch: target, sha: rev, ...(tokens ? { tokens: tokens.map } : {}), map });
  return { outcome: SyncOutcome.Ok, sha: rev, carried: merged.carried, conflicts: [...merged.conflicts, ...(tokens?.conflicts ?? [])], skipped: fresh.skipped, tokens: tokens?.report ?? [] };
}

export type CodeHead = { kind: string; sha: string | null; head: string | null };

export async function codeHead(scope: CodeScope, nodeId: string): Promise<CodeHead | null> {
  const linked = await linkedOf(scope, nodeId);
  return linked ? { kind: linked.origin.kind, sha: linked.origin.sha, head: await linked.source.head(linked.origin.branch) } : null;
}

const NOT_LISTED: RoutesFound = { ok: false, error: UNREADABLE, detail: 'route discovery failed', apps: [] };

export enum Land {
  Frame = 'frame',
  Piece = 'piece'
}

export type AddAsk = { routes: string[]; conditions?: RenderConditions[]; land: Land };

export type CodeAdded = { outcome: SyncOutcome.Ok; skipped: string[]; map: ImportMap; boards: string[]; parent: string | null; piece?: MotionDoc };

type AddRefused = { outcome: SyncRefusal | CodeImportOutcome; error?: string };

const ADD_REFUSED: Record<AddRefusal, SyncRefusal> = {
  [AddRefusal.Full]: SyncOutcome.FrameFull,
  [AddRefusal.NoBoards]: SyncOutcome.Unreachable,
  [AddRefusal.Unsized]: SyncOutcome.Unreachable
};

const newId = () => crypto.randomUUID().slice(0, 8);

const clipIds = (doc: MotionDoc) => new Set([...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips.map((c) => c.id)));

function boardParent(doc: MotionDoc, map: ImportMap | undefined): string | null {
  const first = (map?.pages ?? []).flatMap((p) => p.boards ?? []).map((b) => doc.tracks.flatMap((t) => t.clips).find((c) => c.id === b.clip)).find(Boolean);
  return first?.parent ?? null;
}

const variantsOfAsk = (ask: AddAsk): Variant[] => ask.routes.flatMap((route) => (ask.conditions?.length ? ask.conditions : [BASE_CONDITIONS]).map((conditions) => ({ route, label: labelOf(route, conditions), conditions })));

function relabelled(map: ImportMap, boards: Record<string, string>): ImportMap {
  return { ...map, pages: map.pages.map((p) => (p.boards ? { ...p, boards: p.boards.map((b) => ({ ...b, clip: boards[b.clip] ?? b.clip })) } : p)) };
}

const WHERE: Record<SourceKind, (origin: CodeOriginData) => { repo?: string; folder?: string; upload?: string }> = {
  [SourceKind.Github]: (o) => ({ repo: `https://github.com/${o.repo}` }),
  [SourceKind.Folder]: (o) => ({ folder: o.repo }),
  [SourceKind.Upload]: (o) => ({ upload: o.repo })
};

export async function codeAdd(scope: CodeScope, nodeId: string, ask: AddAsk): Promise<CodeAdded | AddRefused> {
  const linked = await linkedOf(scope, nodeId);
  const store = frameStore(scope.db, scope);
  const local = linked ? await store.read(nodeId) : null;
  if (!linked || !local) {
    return { outcome: SyncOutcome.NotFromCode };
  }
  const variants = variantsOfAsk(ask);
  const room = MAX_FRAME_BOARDS - boardsUsed(linked.origin.map, (id) => clipIds(local.doc).has(id));
  if (variants.length > room) {
    return { outcome: SyncOutcome.FrameFull, error: `this frame holds ${MAX_FRAME_BOARDS - room} of ${MAX_FRAME_BOARDS} pages, the most Pull refreshes in one run: ${room} left` };
  }

  const origin = linked.origin;
  const where = origin.sha && origin.kind === SourceKind.Github ? linked.link(origin.sha) : linked.link('');
  const [fresh, listed] = await Promise.all([importCodeInto(scope, local.canvasId, { ...where, app: origin.app, routes: ask.routes, variants, delay: origin.delay, at: local.at ?? { x: 0, y: 0 } }), routesFound(scope, { ...WHERE[origin.kind as SourceKind](origin), app: origin.app }).catch(() => null)]);
  if (fresh.outcome !== CodeImportOutcome.Ok) {
    return { outcome: fresh.outcome, ...(fresh.error ? { error: fresh.error } : {}) };
  }
  const upstream = await store.read(fresh.frameId);
  await store.remove(fresh.frameId);
  if (!upstream) {
    return { outcome: SyncOutcome.Unreachable };
  }

  const boards = (fresh.boards ?? []).map((b) => b.clip);
  const parent = boardParent(local.doc, origin.map);
  const added = mapOf(listed ?? NOT_LISTED, fresh, { asked: ask.routes, rev: origin.sha });
  const remember = async (map: ImportMap) => rememberOrigin(scope, nodeId, { ...origin, routes: [...new Set([...origin.routes, ...ask.routes])].slice(0, MAX_FRAME_BOARDS), ...(origin.tokens && fresh.tokenMap ? { tokens: { ...fresh.tokenMap, ...origin.tokens } } : {}), map: mergedMap(origin.map, map) });

  if (ask.land === Land.Piece) {
    const map = mergedMap(origin.map, added);
    await remember(added);
    return { outcome: SyncOutcome.Ok, skipped: fresh.skipped, map, boards, parent, piece: upstream.doc };
  }

  const merged = addBoards(local.doc, upstream.doc, boards, parent, newId);
  if (!merged.ok) {
    return { outcome: ADD_REFUSED[merged.refusal], error: merged.detail };
  }
  const written = await store.write(nodeId, local.version, merged.doc, `Imported ${ask.routes.join(', ')}`);
  if (written.outcome !== RevisionOutcome.Written) {
    return { outcome: SyncOutcome.Conflict };
  }
  const map = relabelled(added, merged.boards);
  await remember(map);
  return { outcome: SyncOutcome.Ok, skipped: [...fresh.skipped, ...merged.kept.map((k) => `${k}: renders differently on the new page, kept as its own main`)], map: mergedMap(origin.map, map), boards: boards.map((b) => merged.boards[b] ?? b), parent };
}

export type CodeMap = { kind: string; repo: string; sha: string | null; map: ImportMap | null; used: number; limit: number };

export async function codeMap(scope: CodeScope, nodeId: string): Promise<CodeMap | null> {
  const linked = await linkedOf(scope, nodeId);
  const frame = linked ? await frameStore(scope.db, scope).read(nodeId) : null;
  if (!linked || !frame) {
    return null;
  }
  const here = clipIds(frame.doc);
  return { kind: linked.origin.kind, repo: linked.origin.repo, sha: linked.origin.sha, map: linked.origin.map ?? null, used: boardsUsed(linked.origin.map, (id) => here.has(id)), limit: MAX_FRAME_BOARDS };
}

export function pulledVariants(origin: CodeOriginData): Variant[] | undefined {
  const boards = (origin.map?.pages ?? []).flatMap((p) => (p.boards ?? []).map((b) => ({ route: p.path, conditions: condOf(b.cond) })));
  return boards.length ? boards.map((b) => ({ ...b, label: labelOf(b.route, b.conditions as RenderConditions) })) : undefined;
}
