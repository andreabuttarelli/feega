import type { CommitSeen, PullOpen, RefSeen } from './git-host';
import { entryPath } from './link';
import { FramesRefusal, type FramesDeps, type FramesRefused } from './frames-push';

export type VersionsAsk = { nodeId: string; ref?: string; limit: number };

export type Versions = { ok: true; entry: string; refs: RefSeen[]; commits: CommitSeen[]; pulls: PullOpen[] };

export async function frameVersions(deps: Pick<FramesDeps, 'host' | 'links'>, ask: VersionsAsk): Promise<Versions | FramesRefused> {
  const link = await deps.links.read(ask.nodeId);
  if (!link) {
    return { ok: false, refusal: FramesRefusal.NotLinked };
  }
  const host = await deps.host(link.source, link.repo);
  if (!host) {
    return { ok: false, refusal: FramesRefusal.NotConnected };
  }

  const entry = entryPath(link);
  const [refs, commits, pulls] = await Promise.all([host.listRefs(), host.listCommits(ask.ref ?? link.baseBranch, { limit: ask.limit, path: entry }), host.listPulls()]);
  return { ok: true, entry, refs, commits, pulls };
}
