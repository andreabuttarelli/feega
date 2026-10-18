import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { DataCheck, findNode, patchNodeData } from '$lib/server/repos/canvas';
import { listRevisions, readRevision, type RevisionListing } from '$lib/server/repos/motion-revisions';
import { namesOf, withName } from '$lib/motion/version-names';

type Scope = { orgId: string; nodeId: string };

export type NamedRevision = RevisionListing & { name: string | null };

export type Named = { named: true } | { named: false; error: string };

export async function namedRevisions(db: Db, scope: Scope): Promise<NamedRevision[]> {
  const [listed, node] = await Promise.all([listRevisions(db, scope), findNode(db, scope)]);
  const names = namesOf(node?.data ?? {});
  return listed.map((r) => ({ ...r, name: names[String(r.version)] ?? null }));
}

export async function nameVersion(db: Db, input: Scope & { version: number; name: string; actor: Actor }): Promise<Named> {
  const [node, revision] = await Promise.all([findNode(db, input), readRevision(db, input)]);
  if (!node || !revision) {
    return { named: false, error: 'no_such_version' };
  }

  const versionNames = withName(namesOf(node.data), input.version, input.name);
  const write = await patchNodeData(db, { orgId: input.orgId, nodeId: input.nodeId, patch: { versionNames }, check: DataCheck.Schema, actor: input.actor });
  return write.outcome === 'written' ? { named: true } : { named: false, error: write.outcome };
}
