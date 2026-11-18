import { GitError, GitFailure, type GitHost } from './git-host';
import type { VersionMark } from '$lib/canvas/version-frame';
import { entryPath, type CodeLink } from './link';
import { FramesRefusal, type FramesDeps, type FramesRefused } from './frames-push';

const PULL = /^(?:#|pull\/)(\d+)$/;
const SHA = /^[0-9a-f]{7,40}$/;
const SHORT_SHA = 7;
const VERSION_GAP = 80;

export const MAX_VERSIONS = 4;

export enum VersionKind {
  Named = 'named',
  Commit = 'commit',
  Pull = 'pull'
}

export type VersionRef = { kind: VersionKind; ref: string; label: string; pull?: number };


export type { VersionMark };

export type Place = { canvasId: string; x: number; y: number; w: number; h: number };

export type ImportAtAsk = { link: CodeLink; sha: string; canvasId: string; centre: { x: number; y: number } };

export type CompareDeps = Pick<FramesDeps, 'host'> & {
  links: Pick<FramesDeps['links'], 'read'>;
  placeOf: (nodeId: string) => Promise<Place | null>;
  importAt: (ask: ImportAtAsk) => Promise<{ frameId: string } | { error: string }>;
  mark: (frameId: string, mark: VersionMark) => Promise<void>;
  markOf: (nodeId: string) => Promise<VersionMark | null>;
  remove: (nodeId: string) => Promise<unknown>;
};

export type RetargetAsk = { versionId: string; ref: string };

export type CompareAsk = { nodeId: string; refs: string[] };

export type VersionFrame = VersionMark & { frameId: string };

export type Compared = { ok: true; versions: VersionFrame[] };

export const IMPORT_FAILED = 'import_failed';

export type CompareRefused = FramesRefused | { ok: false; refusal: GitFailure | typeof IMPORT_FAILED; ref: string; error?: string };

export function versionOf(ref: string): VersionRef {
  const pull = ref.match(PULL);
  if (pull) {
    return { kind: VersionKind.Pull, ref, label: `PR #${pull[1]}`, pull: Number(pull[1]) };
  }
  if (SHA.test(ref)) {
    return { kind: VersionKind.Commit, ref, label: ref.slice(0, SHORT_SHA) };
  }
  return { kind: VersionKind.Named, ref, label: ref };
}

async function shaOf(host: GitHost, version: VersionRef): Promise<string> {
  if (version.pull !== undefined) {
    return (await host.pull(version.pull)).headSha;
  }
  const [last] = await host.listCommits(version.ref, { limit: 1 });
  if (!last) {
    throw new GitError(GitFailure.NotFound, 0);
  }
  return last.sha;
}

const failureOf = (e: unknown, ref: string): CompareRefused => {
  if (e instanceof GitError) {
    return { ok: false, refusal: e.failure, ref };
  }
  throw e;
};

type Opened = { link: CodeLink; host: GitHost; place: Place };

async function opened(deps: CompareDeps, linkedId: string, placedId: string): Promise<Opened | FramesRefused> {
  const link = await deps.links.read(linkedId);
  const place = await deps.placeOf(placedId);
  if (!link || !place) {
    return { ok: false, refusal: FramesRefusal.NotLinked };
  }
  const host = await deps.host(link.source, link.repo);
  return host ? { link, host, place } : { ok: false, refusal: FramesRefusal.NotConnected };
}

async function landVersion(deps: CompareDeps, from: Opened & { of: string }, ref: string, at: { x: number; y: number }): Promise<VersionFrame | CompareRefused> {
  const version = versionOf(ref);
  const sha = await shaOf(from.host, version).catch((e: unknown) => failureOf(e, ref));
  if (typeof sha !== 'string') {
    return sha;
  }

  const landed = await deps.importAt({ link: from.link, sha, canvasId: from.place.canvasId, centre: at });
  if ('error' in landed) {
    return { ok: false, refusal: IMPORT_FAILED, ref, error: landed.error };
  }

  const mark = { of: from.of, ref, label: version.label, sha, entry: entryPath(from.link) };
  await deps.mark(landed.frameId, mark);
  return { ...mark, frameId: landed.frameId };
}

const centreOf = (place: Place, shift: number) => ({ x: place.x + shift + place.w / 2, y: place.y + place.h / 2 });

const isRefused = (v: VersionFrame | CompareRefused): v is CompareRefused => 'ok' in v;

export async function frameCompare(deps: CompareDeps, ask: CompareAsk): Promise<Compared | CompareRefused> {
  const from = await opened(deps, ask.nodeId, ask.nodeId);
  if ('ok' in from) {
    return from;
  }

  const versions: VersionFrame[] = [];
  for (const [i, ref] of ask.refs.entries()) {
    const at = centreOf(from.place, (i + 1) * (from.place.w + VERSION_GAP));
    const landed = await landVersion(deps, { ...from, of: ask.nodeId }, ref, at);
    if (isRefused(landed)) {
      return landed;
    }
    versions.push(landed);
  }
  return { ok: true, versions };
}

export async function frameRetarget(deps: CompareDeps, ask: RetargetAsk): Promise<Compared | CompareRefused> {
  const mark = await deps.markOf(ask.versionId);
  if (!mark) {
    return { ok: false, refusal: FramesRefusal.NotLinked };
  }
  const from = await opened(deps, mark.of, ask.versionId);
  if ('ok' in from) {
    return from;
  }

  const landed = await landVersion(deps, { ...from, of: mark.of }, ask.ref, centreOf(from.place, 0));
  if (isRefused(landed)) {
    return landed;
  }
  await deps.remove(ask.versionId);
  return { ok: true, versions: [landed] };
}
