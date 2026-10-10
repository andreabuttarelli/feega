import type { MotionDoc } from './doc';

type AssetRef = MotionDoc['assets'][number];

export function referencedAssets(doc: MotionDoc, library: readonly AssetRef[]): AssetRef[] {
  const used = JSON.stringify([doc.tracks, doc.comps, doc.fonts, doc.fields]);
  const known = new Map([...library, ...doc.assets].map((a) => [a.id, a]));
  return [...known.values()].filter((a) => used.includes(a.id));
}
