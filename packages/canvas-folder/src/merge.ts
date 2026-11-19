import { COLLECTION_DIRS, emptyFolder, isPlainObject, sameJson, sortConflicts, sortEvents, type CollectionName, type Conflict, type Entity, type FolderDoc } from './folder';

export enum Relation {
  Same = 'same',
  Ahead = 'ahead',
  Behind = 'behind',
  Diverged = 'diverged'
}

export type Merged = { doc: FolderDoc; conflicts: Conflict[] };

const WHOLE_ENTITY = '*';
const VERSION = 'version';
const NESTED_FIELDS = new Set(['data']);

type Sides = { base: unknown; ours: unknown; theirs: unknown };

const shown = (value: unknown) => value ?? null;

function settled({ base, ours, theirs }: Sides): { value: unknown } | null {
  if (sameJson(ours, theirs) || sameJson(theirs, base)) {
    return { value: ours };
  }

  if (sameJson(ours, base)) {
    return { value: theirs };
  }

  return null;
}

class EntityMerge {
  private readonly conflicts: Conflict[] = [];

  constructor(
    private readonly collection: string,
    private readonly id: string
  ) {}

  run(sides: Sides): { value: unknown; conflicts: Conflict[] } {
    const plain = settled(sides);
    if (plain) {
      return { value: plain.value, conflicts: [] };
    }

    if (sides.ours === undefined || sides.theirs === undefined) {
      this.record(WHOLE_ENTITY, sides);
      return { value: sides.ours ?? sides.theirs, conflicts: this.conflicts };
    }

    const value = this.fields('', sides as { base: Entity | undefined; ours: Entity; theirs: Entity });
    return { value: { ...value, [VERSION]: this.nextVersion(sides.ours as Entity, sides.theirs as Entity) }, conflicts: this.conflicts };
  }

  private nextVersion(ours: Entity, theirs: Entity): number | undefined {
    if (ours[VERSION] === undefined && theirs[VERSION] === undefined) {
      return undefined;
    }

    return Math.max(Number(ours[VERSION] ?? 0), Number(theirs[VERSION] ?? 0)) + 1;
  }

  private fields(prefix: string, { base, ours, theirs }: { base: Entity | undefined; ours: Entity; theirs: Entity }): Entity {
    const keys = new Set([...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(base ?? {})]);
    const merged: Entity = {};

    for (const key of [...keys].sort()) {
      if (!prefix && key === VERSION) {
        continue;
      }

      const value = this.field(`${prefix}${key}`, { base: base?.[key], ours: ours[key], theirs: theirs[key] });
      if (value !== undefined) {
        merged[key] = value;
      }
    }

    return merged;
  }

  private field(path: string, sides: Sides): unknown {
    const plain = settled(sides);
    if (plain) {
      return plain.value;
    }

    if (NESTED_FIELDS.has(path) && isPlainObject(sides.ours) && isPlainObject(sides.theirs)) {
      return this.fields(`${path}.`, { base: isPlainObject(sides.base) ? sides.base : undefined, ours: sides.ours, theirs: sides.theirs });
    }

    this.record(path, sides);
    return sides.ours;
  }

  private record(field: string, sides: Sides) {
    this.conflicts.push({ collection: this.collection, id: this.id, field, base: shown(sides.base), ours: shown(sides.ours), theirs: shown(sides.theirs) });
  }
}

function mergeCollection(name: CollectionName, base: Record<string, Entity>, ours: Record<string, Entity>, theirs: Record<string, Entity>, conflicts: Conflict[]) {
  const ids = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
  const merged: Record<string, Entity> = {};

  for (const id of [...ids].sort()) {
    const outcome = new EntityMerge(name, id).run({ base: base[id], ours: ours[id], theirs: theirs[id] });
    conflicts.push(...outcome.conflicts);
    if (outcome.value !== undefined) {
      merged[id] = outcome.value as Entity;
    }
  }

  return merged;
}

function unionEvents(ours: Entity[], theirs: Entity[]): Entity[] {
  const byId = new Map<unknown, Entity>();
  [...ours, ...theirs].forEach((event) => byId.set(event.id, byId.get(event.id) ?? event));
  return sortEvents([...byId.values()]);
}

function unionConflicts(...lists: Conflict[][]): Conflict[] {
  const byKey = new Map<string, Conflict>();
  lists.flat().forEach((c) => byKey.set(`${c.collection}/${c.id}/${c.field}`, c));
  return sortConflicts([...byKey.values()]);
}

export function mergeFolders(base: FolderDoc, ours: FolderDoc, theirs: FolderDoc): Merged {
  const plain = settled({ base, ours, theirs });
  if (plain) {
    const doc = plain.value as FolderDoc;
    return { doc: { ...doc, conflicts: unionConflicts(ours.conflicts, theirs.conflicts) }, conflicts: [] };
  }

  const conflicts: Conflict[] = [];
  const doc = emptyFolder();

  const canvas = new EntityMerge('canvas', 'canvas').run({ base: base.canvas, ours: ours.canvas, theirs: theirs.canvas });
  const { [VERSION]: _version, ...canvasFields } = canvas.value as Entity;
  doc.canvas = canvasFields;
  conflicts.push(...canvas.conflicts);

  for (const name of Object.keys(COLLECTION_DIRS) as CollectionName[]) {
    doc.collections[name] = mergeCollection(name, base.collections[name], ours.collections[name], theirs.collections[name], conflicts);
  }

  doc.events = unionEvents(ours.events, theirs.events);
  doc.conflicts = unionConflicts(ours.conflicts, theirs.conflicts, conflicts);
  return { doc, conflicts: sortConflicts(conflicts) };
}

export function relationOf(base: FolderDoc, ours: FolderDoc, disk: FolderDoc): Relation {
  if (sameJson(ours, disk)) {
    return Relation.Same;
  }

  if (sameJson(disk, base)) {
    return Relation.Ahead;
  }

  if (sameJson(ours, base)) {
    return Relation.Behind;
  }

  return Relation.Diverged;
}
