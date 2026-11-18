import { VersionAction, type VersionMark } from '$lib/canvas/version-frame';
import type { GitHost } from './git-host';
import { entryPath, type CodeLink } from './link';
import { FramesRefusal, type FramesDeps, type FramesRefused } from './frames-push';

export type ActionDeps = Pick<FramesDeps, 'host'> & {
  links: Pick<FramesDeps['links'], 'read' | 'save'>;
  markOf: (nodeId: string) => Promise<VersionMark | null>;
  copyAsVariant: (versionId: string) => Promise<string | null>;
};

export type FileAt = { path: string; content: string };

export type FileDiff = { path: string; before: string | null; after: string | null };

export type Restored = { ok: true; nodeId: string; paths: string[] };

export type Variant = { ok: true; frameId: string };

export type CodeDiff = { ok: true; from: string; to: string; files: FileDiff[] };

type Versioned = { mark: VersionMark; link: CodeLink; host: GitHost };

const notLinked: FramesRefused = { ok: false, refusal: FramesRefusal.NotLinked };

async function versioned(deps: ActionDeps, versionId: string): Promise<Versioned | FramesRefused> {
  const mark = await deps.markOf(versionId);
  const link = mark ? await deps.links.read(mark.of) : null;
  if (!mark || !link) {
    return notLinked;
  }
  const host = await deps.host(link.source, link.repo);
  return host ? { mark, link, host } : { ok: false, refusal: FramesRefusal.NotConnected };
}

const pathsOf = (link: CodeLink) => [...new Set([entryPath(link), ...link.files])];

async function diffOf(v: Versioned, to: string): Promise<FileDiff[]> {
  const files = await Promise.all(pathsOf(v.link).map(async (path) => ({ path, before: await v.host.readFile(path, v.mark.sha), after: await v.host.readFile(path, to) })));
  return files.filter((f) => f.before !== f.after);
}

export async function frameRestore(deps: ActionDeps, versionId: string): Promise<Restored | FramesRefused> {
  const v = await versioned(deps, versionId);
  if ('ok' in v) {
    return v;
  }

  const changed = await diffOf(v, v.link.baseSha);
  const restored = changed.filter((f): f is FileDiff & { before: string } => f.before !== null).map((f) => ({ path: f.path, content: f.before }));
  await deps.links.save(v.mark.of, { ...v.link, restored });
  return { ok: true, nodeId: v.mark.of, paths: restored.map((f) => f.path) };
}

export async function frameVariant(deps: ActionDeps, versionId: string): Promise<Variant | FramesRefused> {
  const frameId = (await deps.markOf(versionId)) ? await deps.copyAsVariant(versionId) : null;
  return frameId ? { ok: true, frameId } : notLinked;
}

export async function frameCodeDiff(deps: ActionDeps, versionId: string): Promise<CodeDiff | FramesRefused> {
  const v = await versioned(deps, versionId);
  if ('ok' in v) {
    return v;
  }
  const files = (await diffOf(v, v.link.baseBranch)).map((f) => ({ path: f.path, before: f.after, after: f.before }));
  return { ok: true, from: v.link.baseBranch, to: v.mark.sha, files };
}

export { VersionAction };

type Done = Restored | Variant | CodeDiff;

const ACTIONS: Record<VersionAction, (deps: ActionDeps, versionId: string) => Promise<Done | FramesRefused>> = {
  [VersionAction.Restore]: frameRestore,
  [VersionAction.Variant]: frameVariant,
  [VersionAction.CodeDiff]: frameCodeDiff
};

export const versionAction = (deps: ActionDeps, action: VersionAction, versionId: string) => ACTIONS[action](deps, versionId);
