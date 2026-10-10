import type { MotionDoc } from './doc';

type AssetRef = MotionDoc['assets'][number];

const ASSET_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const usedText = (doc: MotionDoc) => JSON.stringify([doc.tracks, doc.comps, doc.fonts, doc.fields]);

export const mayUseAssets = (doc: MotionDoc) => doc.assets.length > 0 || ASSET_ID.test(usedText(doc));

export function referencedAssets(doc: MotionDoc, library: readonly AssetRef[]): AssetRef[] {
  const used = usedText(doc);
  const known = new Map([...library, ...doc.assets].map((a) => [a.id, a]));
  return [...known.values()].filter((a) => used.includes(a.id));
}
