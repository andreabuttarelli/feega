import { AssetKind } from '@feega/motion-core/motion/components';
import { latestHeads, readHead, readHeads, type MotionHead } from '$lib/server/repos/motion-revisions';
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

type FramesScope = SourceScope & { canvasId: string; nodeIds: string[]; held?: Map<string, number>; phases?: Phases };

async function ownHeads(scope: FramesScope): Promise<Map<string, MotionHead>> {
  const held = [...(scope.held ?? [])].map(([nodeId, version]) => ({ nodeId, version }));
  const [records, read] = await Promise.all([listNodesByIds(scope.db, { orgId: scope.orgId, nodeIds: scope.nodeIds }), readHeads(scope.db, { orgId: scope.orgId, heads: held })]);
  const pointers = records.filter((record) => record.canvasId === scope.canvasId && motionOf(record)).map(headPointer);
  const stale = pointers.filter((p) => !p.version || read.get(p.nodeId)?.version !== p.version);
  const fresh = stale.length ? await latestHeads(scope.db, { orgId: scope.orgId, frames: stale }) : new Map<string, MotionHead>();
  return new Map(pointers.flatMap((p) => {
    const head = fresh.get(p.nodeId) ?? read.get(p.nodeId);
    return head ? [[p.nodeId, head] as const] : [];
  }));
}

export type MediaHint = { kind: AssetKind; width: number | null; height: number | null };

export type BatchedSource = MotionSource & { media: Record<string, MediaHint> };

export type BatchedSources = { frames: Map<string, BatchedSource>; signed: Record<string, string> };

const addresses = (assets: MotionAsset[]): Record<string, string> => Object.fromEntries(assets.flatMap((a) => (a.stored ? [[a.id, a.previewUrl]] : a.url ? [[a.id, a.url]] : [])));

const signedUrls = (assets: MotionAsset[]): Record<string, string> => Object.fromEntries(assets.flatMap((a) => (a.stored && a.url ? [[a.id, a.url]] : [])));

const PREFETCHED = new Set<AssetKind>([AssetKind.Image]);

const mediaHints = (assets: MotionAsset[]): Record<string, MediaHint> =>
  Object.fromEntries(assets.filter((a) => a.url && PREFETCHED.has(a.kind)).map((a) => [a.id, { kind: a.kind, width: a.width ?? null, height: a.height ?? null }]));

export async function motionSources(scope: FramesScope): Promise<BatchedSources> {
  const phases = scope.phases ?? serverTiming();
  const assets = phases.time('assets', motionAssets(scope));
  const mine = await phases.time('heads', ownHeads(scope));
  const namedFor = async (docs: MotionDoc[], skip: readonly MotionAsset[]) => {
    const library = await assets;
    const beyond = [...new Set(docs.flatMap(mentionedIds))].filter((id) => !library.some((a) => a.id === id) && !skip.some((a) => a.id === id));
    return beyond.length ? namedAssets(scope, beyond) : [];
  };
  const [heads, library, early] = await Promise.all([phases.time('linked', linkedHeads(scope.db, { orgId: scope.orgId, heads: mine })), assets, phases.time('named', namedFor([...mine.values()].map((h) => h.doc), []))]);
  const late = await namedFor([...heads.values()].map((h) => h.doc), early);
  const named = [...early, ...late];
  const known = library.map((a) => ({ id: a.id, kind: a.kind, name: a.label }));

  const used = new Map<string, MotionAsset>();
  const frames = new Map(
    [...heads].map(([nodeId, head]) => {
      const ids = new Set([...referencedAssets(head.doc, known).map((a) => a.id), ...mentionedIds(head.doc)]);
      const mine = [...library, ...named].filter((a) => ids.has(a.id));
      mine.forEach((a) => used.set(a.id, a));
      return [nodeId, { revision: head.version, doc: head.doc, assets: addresses(mine), media: mediaHints(mine) }];
    })
  );
  return { frames, signed: signedUrls([...used.values()]) };
}
