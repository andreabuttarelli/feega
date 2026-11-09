import { readHead, readHeads, type MotionHead } from '$lib/server/repos/motion-revisions';
import { listNodesByIds } from '$lib/server/repos/canvas';
import { motionOf } from '$lib/canvas/motion-node';
import { linkedHead } from './linked-mains';
import { assetUrls, motionAssets, namedAssets, type AssetSigner, type MotionScope } from './editor';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { mayUseAssets, mentionedIds, referencedAssets } from '$lib/motion/doc-assets';

export type MotionSource = { revision: number; doc: MotionDoc; assets: Record<string, string> };

type SourceScope = Omit<MotionScope, 'nodeId'> & { sign?: AssetSigner };

export async function sourceAssets(scope: SourceScope, doc: MotionDoc): Promise<Record<string, string>> {
  const library = mayUseAssets(doc) ? await motionAssets(scope) : [];
  const used = new Set(referencedAssets(doc, library.map((a) => ({ id: a.id, kind: a.kind, name: a.label }))).map((a) => a.id));
  const beyond = mentionedIds(doc).filter((id) => !library.some((a) => a.id === id));
  const named = beyond.length ? await namedAssets(scope, beyond) : [];
  return assetUrls([...library.filter((a) => used.has(a.id)), ...named]);
}

export async function motionSource(scope: MotionScope): Promise<MotionSource | null> {
  const saved = await readHead(scope.db, { orgId: scope.orgId, nodeId: scope.nodeId });
  if (!saved) {
    return null;
  }
  const head = await linkedHead(scope.db, { orgId: scope.orgId, nodeId: scope.nodeId, head: saved });
  return { revision: head.version, doc: head.doc, assets: await sourceAssets(scope, head.doc) };
}

type FramesScope = SourceScope & { canvasId: string; nodeIds: string[] };

async function headsOf(scope: FramesScope): Promise<Map<string, MotionHead>> {
  const frames = (await listNodesByIds(scope.db, { orgId: scope.orgId, nodeIds: scope.nodeIds }))
    .filter((record) => record.canvasId === scope.canvasId)
    .flatMap((record) => {
      const node = motionOf(record);
      return node && node.docHeadRevision > 0 ? [{ nodeId: record.id, version: node.docHeadRevision }] : [];
    });
  const saved = await readHeads(scope.db, { orgId: scope.orgId, heads: frames });
  const asked = new Set(frames.map((f) => f.nodeId));
  const linked = await Promise.all([...saved].filter(([nodeId]) => asked.has(nodeId)).map(async ([nodeId, head]) => [nodeId, await linkedHead(scope.db, { orgId: scope.orgId, nodeId, head })] as const));
  return new Map(linked);
}

export async function motionSources(scope: FramesScope): Promise<Map<string, MotionSource>> {
  const heads = await headsOf(scope);
  const docs = [...heads.values()].map((h) => h.doc);
  const library = docs.some(mayUseAssets) ? await motionAssets(scope) : [];
  const beyond = [...new Set(docs.flatMap(mentionedIds))].filter((id) => !library.some((a) => a.id === id));
  const named = beyond.length ? await namedAssets(scope, beyond) : [];
  const known = library.map((a) => ({ id: a.id, kind: a.kind, name: a.label }));

  return new Map(
    [...heads].map(([nodeId, head]) => {
      const used = new Set([...referencedAssets(head.doc, known).map((a) => a.id), ...mentionedIds(head.doc)]);
      return [nodeId, { revision: head.version, doc: head.doc, assets: assetUrls([...library, ...named].filter((a) => used.has(a.id))) }];
    })
  );
}
