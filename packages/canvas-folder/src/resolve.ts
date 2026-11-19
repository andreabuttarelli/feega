import { isPlainObject, type Conflict, type Entity, type FolderDoc, type CollectionName } from './folder';

export enum Keep {
  Mine = 'mine',
  Theirs = 'theirs'
}

const WHOLE_ENTITY = '*';
const CANVAS = 'canvas';
const VERSION = 'version';

const sameRecord = (a: Conflict, b: Conflict) => a.collection === b.collection && a.id === b.id && a.field === b.field;

function withField(entity: Entity, path: string[], value: unknown): Entity {
  const [key, ...rest] = path;
  const next = rest.length === 0 ? value : withField(isPlainObject(entity[key]) ? entity[key] : {}, rest, value);
  const { [key]: _old, ...others } = entity;
  return next === null || next === undefined ? others : { ...others, [key]: next };
}

const bumped = (entity: Entity): Entity => (entity[VERSION] === undefined ? entity : { ...entity, [VERSION]: Number(entity[VERSION]) + 1 });

function theirsApplied(doc: FolderDoc, conflict: Conflict): FolderDoc {
  const path = conflict.field.split('.');

  if (conflict.collection === CANVAS) {
    return { ...doc, canvas: withField(doc.canvas, path, conflict.theirs) };
  }

  const name = conflict.collection as CollectionName;
  const { [conflict.id]: current, ...others } = doc.collections[name];

  if (conflict.field === WHOLE_ENTITY) {
    const kept = conflict.theirs === null ? others : { ...others, [conflict.id]: conflict.theirs as Entity };
    return { ...doc, collections: { ...doc.collections, [name]: kept } };
  }

  const entity = bumped(withField(current ?? {}, path, conflict.theirs));
  return { ...doc, collections: { ...doc.collections, [name]: { ...others, [conflict.id]: entity } } };
}

export function resolveConflict(doc: FolderDoc, conflict: Conflict, keep: Keep): FolderDoc {
  const applied = keep === Keep.Theirs ? theirsApplied(doc, conflict) : doc;
  return { ...applied, conflicts: doc.conflicts.filter((c) => !sameRecord(c, conflict)) };
}
