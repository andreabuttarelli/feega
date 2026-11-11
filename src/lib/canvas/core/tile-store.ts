import { canvasOf, evictions, type DiskEntry } from './tile-cache';

const DB_NAME = 'feega-tile-cache';
const META = 'meta';
const BLOBS = 'blobs';
const ROOT_DIR = 'tiles';
const USED_EVERY_MS = 60_000;
const PRUNE_EVERY_PUTS = 32;

export type TileStore = {
  get: (key: string) => Promise<Blob | null>;
  put: (key: string, blob: Blob) => Promise<void>;
  dropCanvas: (canvasId: string) => Promise<void>;
  bytes: (canvasId?: string) => Promise<number>;
};

type Blobs = { read: (key: string) => Promise<Blob | null>; write: (key: string, blob: Blob) => Promise<void>; remove: (key: string) => Promise<void>; removeCanvas: (canvasId: string) => Promise<void> };

const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => Object.assign(r, { onsuccess: () => resolve(r.result), onerror: () => reject(r.error) }));

const fileName = (key: string) => key.slice(key.indexOf('/') + 1);

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore(META);
        open.result.createObjectStore(BLOBS);
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function opfsBlobs(): Promise<Blobs | null> {
  const root = await navigator.storage?.getDirectory?.().catch(() => null);
  const tiles = await root?.getDirectoryHandle(ROOT_DIR, { create: true }).catch(() => null);
  if (!root || !tiles) {
    return null;
  }
  const dir = (canvasId: string, create: boolean) => tiles.getDirectoryHandle(canvasId, { create });
  return {
    read: async (key) => {
      const file = await (await dir(canvasOf(key), false)).getFileHandle(fileName(key));
      return file.getFile();
    },
    write: async (key, blob) => {
      const file = await (await dir(canvasOf(key), true)).getFileHandle(fileName(key), { create: true });
      const out = await file.createWritable();
      await out.write(blob);
      await out.close();
    },
    remove: async (key) => (await dir(canvasOf(key), false)).removeEntry(fileName(key)),
    removeCanvas: (canvasId) => tiles.removeEntry(canvasId, { recursive: true })
  };
}

function idbBlobs(db: IDBDatabase): Blobs {
  const store = (mode: IDBTransactionMode) => db.transaction(BLOBS, mode).objectStore(BLOBS);
  return {
    read: async (key) => ((await request(store('readonly').get(key))) as Blob | undefined) ?? null,
    write: async (key, blob) => void (await request(store('readwrite').put(blob, key))),
    remove: async (key) => void (await request(store('readwrite').delete(key))),
    removeCanvas: async (canvasId) => void (await request(store('readwrite').delete(IDBKeyRange.bound(`${canvasId}/`, `${canvasId}/￿`))))
  };
}

const NO_STORE: TileStore = { get: async () => null, put: async () => {}, dropCanvas: async () => {}, bytes: async () => 0 };

export function tileStore(cap: number): TileStore {
  if (typeof indexedDB === 'undefined') {
    return NO_STORE;
  }
  const ready = openDb().then(async (db) => (db ? { db, blobs: (await opfsBlobs().catch(() => null)) ?? idbBlobs(db) } : null));
  const meta = async (mode: IDBTransactionMode) => (await ready)?.db.transaction(META, mode).objectStore(META) ?? null;
  const entries = async (): Promise<DiskEntry[]> => {
    const store = await meta('readonly');
    if (!store) {
      return [];
    }
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
    return values.map((v: Omit<DiskEntry, 'key'>, i) => ({ key: String(keys[i]), ...v }));
  };
  const forget = async (keys: readonly string[]) => {
    const at = await ready;
    for (const key of keys) {
      await at?.blobs.remove(key).catch(() => undefined);
      await meta('readwrite').then((s) => s && request(s.delete(key))).catch(() => undefined);
    }
  };
  const touch = async (key: string) => {
    const store = await meta('readwrite');
    const entry = store && ((await request(store.get(key))) as Omit<DiskEntry, 'key'> | undefined);
    if (store && entry && Date.now() - entry.used > USED_EVERY_MS) {
      await request(store.put({ ...entry, used: Date.now() }, key));
    }
  };
  let puts = 0;
  const write = async (key: string, blob: Blob) => {
    const at = await ready;
    await at?.blobs.write(key, blob);
    const store = await meta('readwrite');
    await (store && request(store.put({ bytes: blob.size, used: Date.now() }, key)));
  };
  return {
    get: async (key) => {
      const blob = await (await ready)?.blobs.read(key).catch(() => null);
      if (blob) {
        void touch(key).catch(() => undefined);
      }
      return blob ?? null;
    },
    put: async (key, blob) => {
      try {
        await write(key, blob);
      } catch {
        await forget(evictions(await entries(), cap / 2));
        await write(key, blob).catch(() => undefined);
      }
      if (++puts % PRUNE_EVERY_PUTS === 0) {
        await forget(evictions(await entries(), cap));
      }
    },
    dropCanvas: async (canvasId) => {
      const at = await ready;
      await at?.blobs.removeCanvas(canvasId).catch(() => undefined);
      const store = await meta('readwrite');
      await (store && request(store.delete(IDBKeyRange.bound(`${canvasId}/`, `${canvasId}/￿`))).catch(() => undefined));
    },
    bytes: async (canvasId) => (await entries()).filter((e) => !canvasId || canvasOf(e.key) === canvasId).reduce((sum, e) => sum + e.bytes, 0)
  };
}

export const forgetCanvasTiles = (canvasId: string): Promise<void> => tileStore(Infinity).dropCanvas(canvasId);
