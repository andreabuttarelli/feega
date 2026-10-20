import { readHead } from '$lib/server/repos/motion-revisions';
import { assetUrls, motionAssets, namedAssets, type AssetSigner, type MotionScope } from './editor';
import type { MotionDoc } from '$lib/motion/doc';
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
  const head = await readHead(scope.db, { orgId: scope.orgId, nodeId: scope.nodeId });
  if (!head) {
    return null;
  }
  return { revision: head.version, doc: head.doc, assets: await sourceAssets(scope, head.doc) };
}
