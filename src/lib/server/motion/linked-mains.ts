import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { DataCheck, listMainDependents, listNodesByIds, patchNodeData } from '$lib/server/repos/canvas';
import { readHead, type MotionHead } from '$lib/server/repos/motion-revisions';
import { linkedMains, mainHomesOf, mainsSignature } from '$lib/motion/linked-mains';

const MAX_DEPTH = 8;

type FrameScope = { orgId: string; nodeId: string };

async function homeDocs(db: Db, orgId: string, homes: string[]): Promise<[string, MotionDoc | null][]> {
  const alive = new Set((await listNodesByIds(db, { orgId, nodeIds: homes })).map((n) => n.id));
  return Promise.all(homes.map(async (home) => [home, alive.has(home) ? ((await readHead(db, { orgId, nodeId: home }))?.doc ?? null) : null] as [string, MotionDoc | null]));
}

export async function linkedHead(db: Db, input: FrameScope & { head: MotionHead }): Promise<MotionHead> {
  const loaded = new Map<string, MotionDoc | null>();
  let doc = input.head.doc;

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const missing = mainHomesOf(doc, input.nodeId).filter((home) => !loaded.has(home));
    if (!missing.length) {
      break;
    }
    (await homeDocs(db, input.orgId, missing)).forEach(([home, found]) => loaded.set(home, found));
    doc = linkedMains(doc, input.nodeId, loaded);
  }

  return doc === input.head.doc ? input.head : { ...input.head, doc };
}

const linkedOf = (data: Record<string, unknown>): Record<string, unknown> => (data.linked as Record<string, unknown> | undefined) ?? {};

export async function nudgeInstances(db: Db, input: FrameScope & { doc: MotionDoc; actor: Actor }): Promise<void> {
  const signature = mainsSignature(input.doc, input.nodeId);
  if (!signature) {
    return;
  }

  const stale = (await listMainDependents(db, { orgId: input.orgId, homeId: input.nodeId })).filter((n) => linkedOf(n.data)[input.nodeId] !== signature);
  await Promise.all(stale.map((n) => patchNodeData(db, { orgId: input.orgId, nodeId: n.id, patch: { linked: { [input.nodeId]: signature } }, check: DataCheck.None, actor: input.actor })));
}
