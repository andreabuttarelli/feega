import type { FrameDoc } from './frame-build';
import { sourceStore } from './frame-source-store';

const SOURCES_KEPT = 8;
const HTTP_NO_CONTENT = 204;

export type ReadSource = ((url: string) => Promise<FrameDoc | null>) & { warm: (urls: string[]) => void };

export function sourceReader(fetcher: (url: string) => Promise<Response>, kept = SOURCES_KEPT): ReadSource {
  const held = new Map<string, Promise<FrameDoc | null>>();
  const unread = new Set<string>();

  const keep = (url: string, reading: Promise<FrameDoc | null>) => {
    held.set(url, reading);
    const evictable = [...held.keys()].filter((u) => !unread.has(u));
    for (const old of evictable.slice(0, Math.max(0, evictable.length - kept))) {
      held.delete(old);
    }
  };

  const fetchOnce = (url: string) => {
    const known = held.get(url);
    if (known) {
      return known;
    }

    const reading = fetcher(url)
      .then((res) => (res.ok && res.status !== HTTP_NO_CONTENT ?(res.json() as Promise<FrameDoc>) : null))
      .catch(() => null)
      .then((source) => {
        if (!source) {
          held.delete(url);
          unread.delete(url);
        }
        return source;
      });
    keep(url, reading);
    return reading;
  };

  const read = (url: string) => {
    unread.delete(url);
    return fetchOnce(url);
  };

  const warm = (urls: string[]) => {
    for (const url of urls.filter((u) => !held.has(u))) {
      unread.add(url);
      void fetchOnce(url);
    }
  };

  return Object.assign(read, { warm });
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
type Waiting = { id: string; url: string; settle: (res: Response | Promise<Response>) => void };
type Batch = { tokens: unknown; signed?: Record<string, string>; frames: Record<string, Omit<FrameDoc, 'tokens'>> };

const signedFrame = (batch: Batch, frame: Omit<FrameDoc, 'tokens'>): FrameDoc =>
  ({ ...frame, tokens: batch.tokens, addresses: frame.assets, assets: Object.fromEntries(Object.entries(frame.assets).map(([id, at]) => [id, batch.signed?.[id] ?? at])) }) as FrameDoc;

const FRAME_SOURCE = /^(\/p\/[^/]+\/c\/[^/]+\/motion)\/([0-9a-f-]{36})\/source(?:\?|$)/i;
const HTTP_OK = 200;
const BATCH_MAX = 100;

const answered = (body: FrameDoc): Response => ({ ok: true, status: HTTP_OK, json: async () => body }) as unknown as Response;

function frameBatcher(fetcher: Fetcher): Fetcher {
  const queues = new Map<string, Waiting[]>();

  const ask = async (base: string, waiting: Waiting[]) => {
    const batch = await fetcher(`${base}/sources?ids=${[...new Set(waiting.map((w) => w.id))].join(',')}`)
      .then((res) => (res.ok ? (res.json() as Promise<Batch>) : null))
      .catch(() => null);

    for (const w of waiting) {
      const frame = batch?.frames[w.id];
      w.settle(frame ? answered(signedFrame(batch, frame)) : fetcher(w.url));
    }
  };

  const flush = (base: string) => {
    const waiting = queues.get(base) ?? [];
    queues.delete(base);
    for (let at = 0; at < waiting.length; at += BATCH_MAX) {
      void ask(base, waiting.slice(at, at + BATCH_MAX));
    }
  };

  return (url, init) => {
    const match = FRAME_SOURCE.exec(url);
    if (!match) {
      return fetcher(url, init);
    }

    const [, base, id] = match;
    const queue = queues.get(base);
    if (!queue) {
      queues.set(base, []);
      setTimeout(() => flush(base), 0);
    }
    return new Promise((settle) => queues.get(base)!.push({ id, url, settle }));
  };
}

export type SourceStore = { get: (key: string) => Promise<FrameDoc | null>; put: (key: string, source: FrameDoc) => void };

const NO_STORE: SourceStore = { get: async () => null, put: () => undefined };
const NOTHING: Response = { ok: false, status: HTTP_NO_CONTENT, json: async () => null } as unknown as Response;

function storeKey(url: string): string | null {
  const id = FRAME_SOURCE.exec(url)?.[2];
  const revision = new URL(url, 'http://x').searchParams.get('revision');
  return id && revision ? `${id}@${revision}` : null;
}

function kept(fetch: Fetcher, store: SourceStore): Fetcher {
  return async (url, init) => {
    const key = storeKey(url);
    if (!key) {
      return fetch(url, init);
    }

    const held = await store.get(key).catch(() => null);
    const fresh = fetch(url, init)
      .then((res) => (res.ok && res.status !== HTTP_NO_CONTENT ? (res.json() as Promise<FrameDoc>) : null))
      .catch(() => null)
      .then((source) => {
        if (source?.addresses) {
          const { addresses, ...rest } = source;
          store.put(key, { ...rest, assets: addresses });
        }
        return source;
      });
    if (held) {
      return answered(held);
    }
    const source = await fresh;
    return source ? answered(source) : NOTHING;
  };
}

export const batchedSources = (fetcher: Fetcher, held = SOURCES_KEPT, store: SourceStore = NO_STORE): ReadSource => sourceReader(kept(frameBatcher(fetcher), store), held);

export const frameSources = batchedSources((url, init) => fetch(url, { cache: 'no-cache', ...init }), SOURCES_KEPT, sourceStore());
