import type { MotionDoc } from '@feega/motion-core/motion/doc';

type AssetRef = MotionDoc['assets'][number];

const ASSET_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const WHOLE_ASSET_ID = new RegExp(`^${ASSET_ID.source}$`);

type DocText = { text: string; ids: Set<string> };

const read = new WeakMap<MotionDoc, DocText>();

function docText(doc: MotionDoc): DocText {
  const known = read.get(doc);
  if (known) {
    return known;
  }
  const text = JSON.stringify([doc.tracks, doc.comps, doc.fonts, doc.fields]);
  const made = { text, ids: new Set(text.match(new RegExp(ASSET_ID.source, 'g')) ?? []) };
  read.set(doc, made);
  return made;
}

const usedText = (doc: MotionDoc) => docText(doc).text;

const mentions = (doc: MotionDoc, id: string) => (WHOLE_ASSET_ID.test(id) ? docText(doc).ids.has(id) : usedText(doc).includes(id));

export const mentionedIds = (doc: MotionDoc): string[] => [...docText(doc).ids];

export const mayUseAssets = (doc: MotionDoc) => doc.assets.length > 0 || ASSET_ID.test(usedText(doc));

export function referencedAssets(doc: MotionDoc, library: readonly AssetRef[]): AssetRef[] {
  const known = new Map([...library, ...doc.assets].map((a) => [a.id, a]));
  return [...known.values()].filter((a) => mentions(doc, a.id));
}

export function usedAssetUrls(doc: MotionDoc, urls: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(urls).filter(([id]) => mentions(doc, id)));
}
