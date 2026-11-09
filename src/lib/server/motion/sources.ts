import { AssetKind } from '@feega/motion-core/motion/components';
import { latestHeads, readHead, type MotionHead } from '$lib/server/repos/motion-revisions';
import { listNodesByIds } from '$lib/server/repos/canvas';
import { motionOf } from '$lib/canvas/motion-node';
import { linkedHead, linkedHeads } from './linked-mains';
import { assetUrls, motionAssets, namedAssets, type AssetSigner, type MotionAsset, type MotionScope } from './editor';
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
  const frames = (await listNodesByIds(scope.db, { orgId: scope.orgId, nodeIds: scope.nodeIds })).filter((record) => record.canvasId === scope.canvasId && motionOf(record)).map((record) => record.id);
  const saved = await latestHeads(scope.db, { orgId: scope.orgId, nodeIds: frames });
  return linkedHeads(scope.db, { orgId: scope.orgId, heads: saved });
}

export type MediaHint = { kind: AssetKind; width: number | null; height: number | null };

export type BatchedSource = MotionSource & { media: Record<string, MediaHint> };

const PREFETCHED = new Set<AssetKind>([AssetKind.Image]);

const mediaHints = (assets: MotionAsset[]): Record<string, MediaHint> =>
  Object.fromEntries(assets.filter((a) => a.url && PREFETCHED.has(a.kind)).map((a) => [a.id, { kind: a.kind, width: a.width ?? null, height: a.height ?? null }]));

export async function motionSources(scope: FramesScope): Promise<Map<string, BatchedSource>> {
  const heads = await headsOf(scope);
  const docs = [...heads.values()].map((h) => h.doc);
  const library = docs.some(mayUseAssets) ? await motionAssets(scope) : [];
  const beyond = [...new Set(docs.flatMap(mentionedIds))].filter((id) => !library.some((a) => a.id === id));
  const named = beyond.length ? await namedAssets(scope, beyond) : [];
  const known = library.map((a) => ({ id: a.id, kind: a.kind, name: a.label }));

  return new Map(
    [...heads].map(([nodeId, head]) => {
      const used = new Set([...referencedAssets(head.doc, known).map((a) => a.id), ...mentionedIds(head.doc)]);
      const mine = [...library, ...named].filter((a) => used.has(a.id));
      return [nodeId, { revision: head.version, doc: head.doc, assets: assetUrls(mine), media: mediaHints(mine) }];
    })
  );
}
