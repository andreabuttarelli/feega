import { readHead } from '$lib/server/repos/motion-revisions';
import { assetUrls, motionAssets, type MotionScope } from './editor';
import type { MotionDoc } from '$lib/motion/doc';
import { referencedAssets } from '$lib/motion/doc-assets';

export type MotionSource = { revision: number; doc: MotionDoc; assets: Record<string, string> };

export async function motionSource(scope: MotionScope): Promise<MotionSource | null> {
  const head = await readHead(scope.db, { orgId: scope.orgId, nodeId: scope.nodeId });
  if (!head) {
    return null;
  }
  const library = await motionAssets(scope);
  const used = new Set(referencedAssets(head.doc, library.map((a) => ({ id: a.id, kind: a.kind, name: a.label }))).map((a) => a.id));
  const assets = library.filter((a) => used.has(a.id));
  return { revision: head.version, doc: head.doc, assets: assetUrls(assets) };
}
