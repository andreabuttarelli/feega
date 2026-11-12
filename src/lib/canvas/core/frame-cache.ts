import type { FrameDoc } from './frame-build';

export type CacheScope = { userId: string; orgId: string };
export type Kept = { key: string; canvasId: string; nodeId: string; bytes: number; at: number };
export type CacheLimits = { entries: number; bytes: number };

export type CacheShelf<V = FrameDoc> = {
  read: (key: string) => Promise<V | null>;
  write: (kept: Kept, value?: V) => Promise<void>;
  listed: () => Promise<Kept[]>;
  drop: (keys: string[]) => Promise<void>;
};

export type FrameCache<V = FrameDoc> = {
  take: (key: string) => Promise<V | null>;
  keep: (key: string, value: V) => Promise<void>;
  forgetCanvas: (canvasId: string) => Promise<void>;
};

export const CACHE_LIMITS: CacheLimits = { entries: 800, bytes: 96 * 1024 * 1024 };
export const THUMB_LIMITS: CacheLimits = { entries: 1500, bytes: 128 * 1024 * 1024 };

const SOURCES_DB = 'feega-frame-cache';
export const THUMBS_DB = 'feega-frame-thumbs';
const FORGOTTEN_ON_LOGOUT = [SOURCES_DB, THUMBS_DB];

export const cacheName = (scope: CacheScope, base = SOURCES_DB) => `${base}:${scope.userId}:${scope.orgId}`;

export const keptKey = (k: { canvasId: string; nodeId: string; revision: number | string; look: string; linked: string }) => `${k.canvasId}/${k.nodeId}@${k.revision}@${k.look}@${k.linked}`;

function partsOf(key: string): { canvasId: string; nodeId: string } {
  const [canvasId, rest = ''] = key.split('/');
  return { canvasId, nodeId: rest.split(/[@:]/)[0] };
}

function overLimits(kept: Kept[], key: string, limits: CacheLimits): string[] {
  const { nodeId, canvasId } = partsOf(key);
  const replaced = kept.filter((k) => k.key !== key && k.nodeId === nodeId && k.canvasId === canvasId).map((k) => k.key);
  const left = kept.filter((k) => !replaced.includes(k.key)).sort((a, b) => b.at - a.at);
  let bytes = 0;
  const evicted = left.filter((k, i) => {
    bytes += k.bytes;
    return i >= limits.entries || bytes > limits.bytes;
  });
  return [...replaced, ...evicted.map((k) => k.key)];
}

const jsonSize = (value: unknown) => JSON.stringify(value).length;

export function frameCache<V = FrameDoc>(shelf: CacheShelf<V>, limits: CacheLimits = CACHE_LIMITS, now: () => number = Date.now, sizeOf: (value: V) => number = jsonSize): FrameCache<V> {
  const metaOf = (key: string, bytes: number): Kept => ({ key, ...partsOf(key), bytes, at: now() });
  const sizes = new Map<string, number>();

  return {
    take: async (key) => {
      const source = await shelf.read(key).catch(() => null);
      if (source) {
        const bytes = sizes.get(key) ?? sizeOf(source);
        sizes.set(key, bytes);
        await shelf.write(metaOf(key, bytes)).catch(() => undefined);
      }
      return source;
    },
    keep: async (key, value) => {
      const bytes = sizeOf(value);
      sizes.set(key, bytes);
      await shelf.write(metaOf(key, bytes), value);
      const dropped = overLimits(await shelf.listed(), key, limits);
      if (dropped.length) {
        await shelf.drop(dropped);
      }
    },
    forgetCanvas: async (canvasId) => {
      const gone = (await shelf.listed()).filter((k) => k.canvasId === canvasId).map((k) => k.key);
      if (gone.length) {
        await shelf.drop(gone);
      }
    }
  };
}

export function memoryShelf<V = FrameDoc>(): CacheShelf<V> {
  const sources = new Map<string, V>();
  const metas = new Map<string, Kept>();
  return {
    read: async (key) => sources.get(key) ?? null,
    write: async (kept, value) => {
      metas.set(kept.key, kept);
      if (value) {
        sources.set(kept.key, value);
      }
    },
    listed: async () => [...metas.values()],
    drop: async (keys) => keys.forEach((k) => (sources.delete(k), metas.delete(k)))
  };
}

const SOURCES = 'sources';
const KEPT = 'kept';

const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => Object.assign(r, { onsuccess: () => resolve(r.result), onerror: () => reject(r.error) }));

const finished = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => Object.assign(tx, { oncomplete: () => resolve(), onerror: () => reject(tx.error), onabort: () => reject(tx.error) }));

const SHELF_VERSION = 2;

export function idbShelf<V = FrameDoc>(name: string, factory: IDBFactory = indexedDB): CacheShelf<V> {
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(name, SHELF_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      [...db.objectStoreNames].filter((s) => s !== SOURCES && s !== KEPT).forEach((s) => db.deleteObjectStore(s));
      [SOURCES, KEPT].filter((s) => !db.objectStoreNames.contains(s)).forEach((s) => db.createObjectStore(s));
    };
    open.onsuccess = () => {
      open.result.onversionchange = () => open.result.close();
      resolve(open.result);
    };
    open.onerror = () => reject(open.error);
  });
  const tx = async (mode: IDBTransactionMode) => (await opening).transaction([SOURCES, KEPT], mode);

  return {
    read: async (key) => ((await request((await tx('readonly')).objectStore(SOURCES).get(key))) as V | undefined) ?? null,
    write: async (kept, value) => {
      const t = await tx('readwrite');
      t.objectStore(KEPT).put(kept, kept.key);
      if (value) {
        t.objectStore(SOURCES).put(value, kept.key);
      }
      await finished(t);
    },
    listed: async () => (await request((await tx('readonly')).objectStore(KEPT).getAll())) as Kept[],
    drop: async (keys) => {
      const t = await tx('readwrite');
      keys.forEach((k) => (t.objectStore(SOURCES).delete(k), t.objectStore(KEPT).delete(k)));
      await finished(t);
    }
  };
}

const opened = new Map<string, FrameCache>();

export function scopedCache(scope: CacheScope | null): FrameCache | null {
  if (!scope || typeof indexedDB === 'undefined') {
    return null;
  }
  const name = cacheName(scope);
  return opened.get(name) ?? opened.set(name, frameCache(idbShelf(name))).get(name)!;
}

export async function forgetFrameCaches(factory: IDBFactory = indexedDB): Promise<void> {
  opened.clear();
  const names = (await factory.databases().catch(() => [])).flatMap((d) => (d.name ? [d.name] : []));
  names.filter((n) => FORGOTTEN_ON_LOGOUT.some((base) => n === base || n.startsWith(`${base}:`))).forEach((n) => factory.deleteDatabase(n));
}
