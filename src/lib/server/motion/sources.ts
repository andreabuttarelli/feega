import { AssetKind } from '@feega/motion-core/motion/components';
import { latestHeads, readHead, type MotionHead } from '$lib/server/repos/motion-revisions';
import { headPointer } from './head-pointer';
import { listNodesByIds } from '$lib/server/repos/canvas';
import { motionOf } from '$lib/canvas/motion-node';
import { linkedHead, linkedHeads } from './linked-mains';
import { assetUrls, motionAssets, namedAssets, type AssetSigner, type MotionAsset, type MotionScope } from './editor';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { mayUseAssets, mentionedIds, referencedAssets } from '$lib/motion/doc-assets';
import { serverTiming, type Phases } from '$lib/server/server-timing';

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

type FramesScope = SourceScope & { canvasId: string; nodeIds: string[]; phases?: Phases };

async function headsOf(scope: FramesScope, phases: Phases): Promise<Map<string, MotionHead>> {
  const mine = await phases.time('heads', (async () => {
    const records = await listNodesByIds(scope.db, { orgId: scope.orgId, nodeIds: scope.nodeIds });
    const frames = records.filter((record) => record.canvasId === scope.canvasId && motionOf(record));
    return latestHeads(scope.db, { orgId: scope.orgId, frames: frames.map(headPointer) });
  })());
  return phases.time('linked', linkedHeads(scope.db, { orgId: scope.orgId, heads: mine }));
}

export type MediaHint = { kind: AssetKind; width: number | null; height: number | null };

export type BatchedSource = MotionSource & { media: Record<string, MediaHint> };

const PREFETCHED = new Set<AssetKind>([AssetKind.Image]);

const unsigned: AssetSigner = async () => new Map();

const stableUrls = (assets: MotionAsset[]): Record<string, string> => Object.fromEntries(assets.map((a) => [a.id, a.url ?? a.previewUrl]));

const mediaHints = (assets: MotionAsset[]): Record<string, MediaHint> =>
  Object.fromEntries(assets.filter((a) => PREFETCHED.has(a.kind)).map((a) => [a.id, { kind: a.kind, width: a.width ?? null, height: a.height ?? null }]));

export async function motionSources(scope: FramesScope): Promise<Map<string, BatchedSource>> {
  const phases = scope.phases ?? serverTiming();
  const [heads, library] = await Promise.all([headsOf(scope, phases), phases.time('assets', motionAssets({ ...scope, sign: unsigned }))]);
  const docs = [...heads.values()].map((h) => h.doc);
  const beyond = [...new Set(docs.flatMap(mentionedIds))].filter((id) => !library.some((a) => a.id === id));
  const named = await phases.time('named', beyond.length ? namedAssets({ ...scope, sign: unsigned }, beyond) : Promise.resolve([]));
  const known = library.map((a) => ({ id: a.id, kind: a.kind, name: a.label }));

  return new Map(
    [...heads].map(([nodeId, head]) => {
      const used = new Set([...referencedAssets(head.doc, known).map((a) => a.id), ...mentionedIds(head.doc)]);
      const mine = [...library, ...named].filter((a) => used.has(a.id));
      return [nodeId, { revision: head.version, doc: head.doc, assets: stableUrls(mine), media: mediaHints(mine) }];
    })
  );
}
