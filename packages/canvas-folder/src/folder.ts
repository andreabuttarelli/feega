export type Entity = Record<string, unknown>;

export const COLLECTION_DIRS = {
  nodes: 'nodes',
  connections: 'connections',
  media: 'media',
  codeLinks: 'code-links'
} as const;

export type CollectionName = keyof typeof COLLECTION_DIRS;

export type Conflict = { collection: string; id: string; field: string; base: unknown; ours: unknown; theirs: unknown };

export type FolderDoc = {
  canvas: Entity;
  collections: Record<CollectionName, Record<string, Entity>>;
  events: Entity[];
  conflicts: Conflict[];
};

export type FolderFiles = Map<string, string>;

const CANVAS_FILE = 'canvas.json';
const EVENTS_FILE = 'events.json';
const CONFLICTS_FILE = 'conflicts.json';
const JSON_SUFFIX = '.json';
const INDENT = 2;

const COLLECTIONS = Object.keys(COLLECTION_DIRS) as CollectionName[];

const isPlainObject = (value: unknown): value is Entity => typeof value === 'object' && value !== null && !Array.isArray(value);

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedKeys);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, sortedKeys(value[key])])
  );
}

export const canonicalJson = (value: unknown) => `${JSON.stringify(sortedKeys(value), null, INDENT)}\n`;

export const sameJson = (a: unknown, b: unknown) => canonicalJson(a ?? null) === canonicalJson(b ?? null);

const compareIds = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)));

export const sortEvents = (events: Entity[]) => [...events].sort((a, b) => compareIds(a.id, b.id));

const conflictKey = (c: Conflict) => `${c.collection}\u0000${c.id}\u0000${c.field}`;

export const sortConflicts = (conflicts: Conflict[]) => [...conflicts].sort((a, b) => conflictKey(a).localeCompare(conflictKey(b)));

export const emptyFolder = (): FolderDoc => ({
  canvas: {},
  collections: { nodes: {}, connections: {}, media: {}, codeLinks: {} },
  events: [],
  conflicts: []
});

export function toFiles(doc: FolderDoc): FolderFiles {
  const files: [string, string][] = [
    [CANVAS_FILE, canonicalJson(doc.canvas)],
    [EVENTS_FILE, canonicalJson(sortEvents(doc.events))],
    [CONFLICTS_FILE, canonicalJson(sortConflicts(doc.conflicts))]
  ];

  for (const name of COLLECTIONS) {
    for (const [id, entity] of Object.entries(doc.collections[name])) {
      files.push([`${COLLECTION_DIRS[name]}/${id}${JSON_SUFFIX}`, canonicalJson(entity)]);
    }
  }

  return new Map(files.sort(([a], [b]) => (a < b ? -1 : 1)));
}

function collectionOf(path: string): { name: CollectionName; id: string } | null {
  const [dir, file, ...rest] = path.split('/');
  const name = COLLECTIONS.find((c) => COLLECTION_DIRS[c] === dir);
  if (!name || !file?.endsWith(JSON_SUFFIX) || rest.length > 0) {
    return null;
  }

  return { name, id: file.slice(0, -JSON_SUFFIX.length) };
}

export function fromFiles(files: FolderFiles): FolderDoc {
  const doc = emptyFolder();
  const read = (path: string) => {
    const text = files.get(path);
    return text === undefined ? undefined : JSON.parse(text);
  };

  doc.canvas = read(CANVAS_FILE) ?? {};
  doc.events = sortEvents(read(EVENTS_FILE) ?? []);
  doc.conflicts = sortConflicts(read(CONFLICTS_FILE) ?? []);

  for (const [path, text] of files) {
    const place = collectionOf(path);
    if (!place) {
      continue;
    }

    doc.collections[place.name][place.id] = JSON.parse(text);
  }

  return doc;
}

export type AssetRef = { sha256: string; ext: string };

const ASSET_DIR = 'assets';

export const assetPath = ({ sha256, ext }: AssetRef) => `${ASSET_DIR}/${sha256}${ext ? `.${ext}` : ''}`;

const REMOTE = /^https?:\/\//;

export const remoteOnly = (doc: FolderDoc): Entity[] => Object.values(doc.collections.media).filter((m) => !m.sha256 && typeof m.url === 'string' && REMOTE.test(m.url));

export { isPlainObject };
