import type { FrameDoc } from './frame-build';
import type { SourceStore } from './frame-sources';

const DB_NAME = 'feega-frame-sources';
const STORE = 'sources';
const LAST_CHAR = '￿';

const NO_STORE: SourceStore = { get: async () => null, put: () => undefined };

const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => Object.assign(r, { onsuccess: () => resolve(r.result), onerror: () => reject(r.error) }));

const idle = (work: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(work) : setTimeout(work, 0));

export function sourceStore(): SourceStore {
  if (typeof indexedDB === 'undefined') {
    return NO_STORE;
  }
  const opening = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  const store = async (mode: IDBTransactionMode) => (await opening)?.transaction(STORE, mode).objectStore(STORE) ?? null;

  const put = async (key: string, source: FrameDoc) => {
    const s = await store('readwrite');
    const id = key.slice(0, key.indexOf('@') + 1);
    s?.delete(IDBKeyRange.bound(id, `${id}${LAST_CHAR}`));
    s?.put(source, key);
  };

  return {
    get: async (key) => {
      const s = await store('readonly').catch(() => null);
      return s ? (((await request(s.get(key)).catch(() => null)) as FrameDoc | null) ?? null) : null;
    },
    put: (key, source) => void idle(() => void put(key, source).catch(() => undefined))
  };
}
