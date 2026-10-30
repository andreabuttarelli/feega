import type { NodeData } from './node-patch';
import type { Op } from './op-queue';
import type { SentOp } from './sent-ops';

export type Shelf = {
  read: (key: string) => Promise<unknown>;
  write: (key: string, value: unknown) => Promise<void>;
};

export type PlaceEntry = { action: string; id: string; fields: Record<string, number> };

export type OutboxParts = { ops: Op[]; nodes: Record<string, NodeData>; places: PlaceEntry[]; sent: SentOp[] };

const EMPTY: OutboxParts = { ops: [], nodes: {}, places: [], sent: [] };

const DB_NAME = 'feega-outbox';
const STORE = 'outbox';

function request<T>(asked: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    asked.onsuccess = () => resolve(asked.result);
    asked.onerror = () => reject(asked.error);
  });
}

export type ShelfPlace = { db: string; store: string };

const OUTBOX_PLACE: ShelfPlace = { db: DB_NAME, store: STORE };

export function idbShelf(factory: IDBFactory = indexedDB, place: ShelfPlace = OUTBOX_PLACE): Shelf {
  let opened: Promise<IDBDatabase> | null = null;

  function db(): Promise<IDBDatabase> {
    if (opened) {
      return opened;
    }
    const asked = factory.open(place.db, 1);
    asked.onupgradeneeded = () => asked.result.createObjectStore(place.store);
    opened = request(asked);
    return opened;
  }

  return {
    read: async (key) => request((await db()).transaction(place.store).objectStore(place.store).get(key)),
    write: async (key, value) => { await request((await db()).transaction(place.store, 'readwrite').objectStore(place.store).put(value, key)); }
  };
}

export async function openOutbox(shelf: Shelf, key: string) {
  const stored = await shelf.read(key).catch(() => null);
  let parts: OutboxParts = { ...EMPTY, ...((stored ?? {}) as Partial<OutboxParts>) };

  async function save(changed: Partial<OutboxParts>) {
    parts = { ...parts, ...changed };
    await shelf.write(key, parts).catch(() => undefined);
  }

  return { ...parts, save };
}

export type Outbox = Awaited<ReturnType<typeof openOutbox>>;
