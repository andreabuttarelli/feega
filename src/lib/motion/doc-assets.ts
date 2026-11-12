import type { MotionDoc } from '@feega/motion-core/motion/doc';

type AssetRef = MotionDoc['assets'][number];

const ASSET_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const WHOLE_ASSET_ID = new RegExp(`^${ASSET_ID.source}$`);

const ASSET_IDS = new RegExp(ASSET_ID.source, 'g');

const usedParts = (doc: MotionDoc) => [doc.tracks, doc.comps, doc.fonts, doc.fields];

const texts = new WeakMap<MotionDoc, string>();

function usedText(doc: MotionDoc): string {
  const known = texts.get(doc);
  if (known !== undefined) {
    return known;
  }
  const text = JSON.stringify(usedParts(doc));
  texts.set(doc, text);
  return text;
}

const idsRead = new WeakMap<object, readonly string[]>();

function idsIn(value: unknown): readonly string[] {
  if (typeof value === 'string') {
    return value.match(ASSET_IDS) ?? [];
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  const known = idsRead.get(value);
  if (known) {
    return known;
  }
  const keys = Array.isArray(value) ? [] : Object.keys(value).flatMap(idsIn);
  const ids = [...new Set([...keys, ...Object.values(value).flatMap(idsIn)])];
  idsRead.set(value, ids);
  return ids;
}

const docIds = (doc: MotionDoc) => new Set(usedParts(doc).flatMap(idsIn));

const mentions = (doc: MotionDoc, id: string) => (WHOLE_ASSET_ID.test(id) ? docIds(doc).has(id) : usedText(doc).includes(id));

export const mentionedIds = (doc: MotionDoc): string[] => [...docIds(doc)];

export const mayUseAssets = (doc: MotionDoc) => doc.assets.length > 0 || ASSET_ID.test(usedText(doc));

export function referencedAssets(doc: MotionDoc, library: readonly AssetRef[]): AssetRef[] {
  const known = new Map([...library, ...doc.assets].map((a) => [a.id, a]));
  return [...known.values()].filter((a) => mentions(doc, a.id));
}

export function usedAssetUrls(doc: MotionDoc, urls: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(urls).filter(([id]) => mentions(doc, id)));
}
