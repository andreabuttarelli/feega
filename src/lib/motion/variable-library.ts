import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { activeModeOf, bindVariable, defineVariable, setCollection, variableValue } from './variables';
import { VarType, keyOf, splitKey, type Collection, type Variables } from '@feega/motion-core/motion/variables-model';

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

export function bindFromLibrary(doc: MotionDoc, library: Variables, clipId: string, target: string, key: string): OpResult {
  const collection = splitKey(key)?.[0] ?? '';
  const shared = library[collection];
  if (!shared) {
    return { ok: false, error: `no collection ${collection}` };
  }
  const adopted = adoptCollection(doc, collection, shared);
  return adopted.ok ? bindVariable(adopted.doc, clipId, target, key) : adopted;
}

export type Recoloured = { result: OpResult; collection: Collection | null };

export function recolour(doc: MotionDoc, library: Variables, key: string, colour: string): Recoloured {
  const [group, name] = splitKey(key) ?? ['', ''];
  const shared = doc.variables?.[group] ?? library[group];
  const variable = shared?.vars[name];
  if (!shared || !variable) {
    return { result: { ok: false, error: `no variable ${key}` }, collection: null };
  }
  const adopted = adoptCollection(doc, group, shared);
  if (!adopted.ok) {
    return { result: adopted, collection: null };
  }
  const mode = activeModeOf(adopted.doc, group);
  const result = defineVariable(adopted.doc, group, name, { type: variable.type, values: { ...variable.values, [mode]: colour } });
  return { result, collection: result.ok ? (result.doc.variables?.[group] ?? null) : null };
}

export type ColourToken = { key: string; collection: string; name: string; colour: string };

export function colourTokens(library: Variables): ColourToken[] {
  return Object.entries(library).flatMap(([collection, c]) =>
    Object.entries(c.vars)
      .filter(([, v]) => v.type === VarType.Colour)
      .map(([name]) => ({ key: keyOf(collection, name), collection, name, colour: String(variableValue(library, keyOf(collection, name)) ?? '') }))
  );
}

export function recolouredCollection(collection: Collection, name: string, colour: string): Collection | null {
  const variable = collection.vars[name];
  if (!variable) {
    return null;
  }
  const mode = collection.active && collection.modes.includes(collection.active) ? collection.active : collection.modes[0];
  return { ...collection, vars: { ...collection.vars, [name]: { ...variable, values: { ...variable.values, [mode]: colour } } } };
}
