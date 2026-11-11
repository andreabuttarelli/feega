import { env } from '$env/dynamic/private';
import { codeOriginSchema, type CodeOriginData } from '$lib/canvas/motion-node';
import { findNode } from '$lib/server/repos/canvas';
import { frameStore } from '$lib/server/motion/move-element';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { localModeRefusal } from '$lib/server/local/local-mode';
import { githubFor } from './github-runtime';
import type { GithubCall } from './github';
import { repoOf } from './repo';
import { rebased, tokenCall } from './repo-sync';
import { baselined } from '$lib/canvas/code-look';
import { applyEdits, editsOf, patchOf, type FileChange } from './write-back';
import { CodeImportOutcome } from './import-code';
import { importCodeInto, rememberOrigin, type CodeImportAsk, type CodeScope } from './canvas-import';
import { githubSource, SourceKind, type CodeSource } from './code-source';
import { folderOf, folderSource } from './folder-source';
import { uploadedArchive, uploadOf, uploadSource } from './upload-source';
import { conditionsOf } from './render-conditions';

export enum SyncOutcome {
  Ok = 'ok',
  NotFromCode = 'not_from_code',
  NoChanges = 'no_changes',
  NoGithub = 'no_github',
  PublishFailed = 'publish_failed',
  UpToDate = 'up_to_date',
  Unreachable = 'unreachable',
  Conflict = 'conflict',
  NoSync = 'no_sync'
}

export type SyncRefusal = Exclude<SyncOutcome, SyncOutcome.Ok | SyncOutcome.UpToDate>;

export const SYNC_STATUS: Record<SyncRefusal, number> = {
  [SyncOutcome.NotFromCode]: 404,
  [SyncOutcome.NoChanges]: 409,
  [SyncOutcome.NoGithub]: 412,
  [SyncOutcome.PublishFailed]: 502,
  [SyncOutcome.Unreachable]: 502,
  [SyncOutcome.Conflict]: 409,
  [SyncOutcome.NoSync]: 409
};

const UNPUBLISHED: Record<SourceKind, SyncRefusal> = {
  [SourceKind.Github]: SyncOutcome.NoGithub,
  [SourceKind.Folder]: SyncOutcome.PublishFailed,
  [SourceKind.Upload]: SyncOutcome.NoSync
};

type Linked = { origin: CodeOriginData; source: CodeSource; link: (rev: string) => Pick<CodeImportAsk, 'repo' | 'folder' | 'upload'> };

const BRANCH_PREFIX = 'feega/';
const TITLE = 'UI edits from feega';

async function githubCall(scope: CodeScope): Promise<GithubCall | null> {
  const linked = await githubFor(scope.db, scope).call().catch(() => null);
  return linked ?? (env.GITHUB_TOKEN ? tokenCall(env.GITHUB_TOKEN) : null);
}

type SourceOf = (scope: CodeScope, origin: CodeOriginData) => Promise<Linked | null>;

const SOURCES: Record<SourceKind, SourceOf> = {
  [SourceKind.Github]: async (scope, origin) => {
    const ref = repoOf(`https://github.com/${origin.repo}`);
    return ref ? { origin, source: githubSource(ref, await githubCall(scope)), link: (rev) => ({ repo: `https://github.com/${origin.repo}/tree/${rev}` }) } : null;
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

type Changed = { linked: Linked; rev: string; files: FileChange[]; skipped: string[] };

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
  const done = await applyEdits(editsOf(frame.doc), linked.source.read(rev));
  return { linked, rev, ...done };
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
    await settle(scope, nodeId, done.linked);
  }
  return { outcome: SyncOutcome.Ok, ...out, skipped: done.skipped };
}

async function settle(scope: CodeScope, nodeId: string, linked: Linked): Promise<void> {
  const store = frameStore(scope.db, scope);
  const frame = await store.read(nodeId);
  if (frame) {
    await store.write(nodeId, frame.version, baselined(frame.doc), 'Wrote edits to the folder');
  }
  await rememberOrigin(scope, nodeId, { ...linked.origin, sha: await linked.source.head(null) });
}

export type CodePulled = { outcome: SyncOutcome.Ok | SyncOutcome.UpToDate; sha: string; carried: number; conflicts: string[]; skipped: string[] };

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
    return { outcome: SyncOutcome.UpToDate, sha: rev, carried: 0, conflicts: [], skipped: [] };
  }

  const fresh = await importCodeInto(scope, local.canvasId, { ...linked.link(rev), routes: linked.origin.routes, conditions: conditionsOf(linked.origin.conditions), at: local.at ?? { x: 0, y: 0 } });
  if (fresh.outcome !== CodeImportOutcome.Ok) {
    return { outcome: SyncOutcome.Unreachable, error: fresh.error ?? fresh.outcome };
  }
  const upstream = await store.read(fresh.frameId);
  await store.remove(fresh.frameId);
  if (!upstream) {
    return { outcome: SyncOutcome.Unreachable };
  }

  const merged = rebased(local.doc, upstream.doc);
  const written = await store.write(nodeId, local.version, merged.doc, `Pulled ${linked.origin.repo}@${rev.slice(0, 7)}`);
  if (written.outcome !== RevisionOutcome.Written) {
    return { outcome: SyncOutcome.Conflict };
  }
  await rememberOrigin(scope, nodeId, { ...linked.origin, branch: target, sha: rev });
  return { outcome: SyncOutcome.Ok, sha: rev, carried: merged.carried, conflicts: merged.conflicts, skipped: fresh.skipped };
}

export type CodeHead = { kind: string; sha: string | null; head: string | null };

export async function codeHead(scope: CodeScope, nodeId: string): Promise<CodeHead | null> {
  const linked = await linkedOf(scope, nodeId);
  return linked ? { kind: linked.origin.kind, sha: linked.origin.sha, head: await linked.source.head(linked.origin.branch) } : null;
}
