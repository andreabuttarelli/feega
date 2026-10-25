import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { setCollection } from './variables';
import type { Collection, Variables } from '@feega/motion-core/motion/variables-model';

export function variableLibraryOf(docs: readonly MotionDoc[]): Variables {
  const library: Variables = {};
  for (const doc of docs) {
    for (const [name, collection] of Object.entries(doc.variables ?? {})) {
      library[name] ??= collection;
    }
  }
  return library;
}

function keepingMode(doc: MotionDoc, name: string, collection: Collection): Collection {
  const active = doc.variables?.[name]?.active;
  const { active: _shared, ...rest } = collection;
  return active && collection.modes.includes(active) ? { ...rest, active } : rest;
}

export function adoptCollection(doc: MotionDoc, name: string, collection: Collection): OpResult {
  return doc.variables?.[name] ? { ok: true, doc } : setCollection(doc, name, keepingMode(doc, name, collection));
}

export function syncedCollection(doc: MotionDoc, name: string, collection: Collection): MotionDoc | null {
  if (!doc.variables?.[name]) {
    return null;
  }
  const synced = setCollection(doc, name, keepingMode(doc, name, collection));
  return synced.ok ? synced.doc : null;
}
