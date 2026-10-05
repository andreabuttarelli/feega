import { readHead } from '$lib/server/repos/motion-revisions';
import { assetUrls, motionAssets, type MotionScope } from './editor';
import type { MotionDoc } from '$lib/motion/doc';

export type MotionSource = { revision: number; doc: MotionDoc; assets: Record<string, string> };

export async function motionSource(scope: MotionScope): Promise<MotionSource | null> {
  const head = await readHead(scope.db, { orgId: scope.orgId, nodeId: scope.nodeId });
  if (!head) {
    return null;
  }
  const used = new Set(head.doc.assets.map((a) => a.id));
  const assets = used.size ? (await motionAssets(scope)).filter((a) => used.has(a.id)) : [];
  return { revision: head.version, doc: head.doc, assets: assetUrls(assets) };
}
