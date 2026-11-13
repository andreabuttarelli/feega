import type { FrameDoc } from './frame-build';
import { StartupStep, markStartup } from './startup-marks';
import { keptKey, scopedCache, type CacheScope, type FrameCache } from './frame-cache';

const SOURCES_KEPT = 8;
const HTTP_NO_CONTENT = 204;

export type ReadSource = ((url: string) => Promise<FrameDoc | null>) & { warm: (urls: string[]) => void; forget: (url: string) => void };

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

  const forget = (url: string) => {
    held.delete(url);
    unread.delete(url);
  };

  return Object.assign(read, { warm, forget });
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

const paramOf = (url: string, name: string) => new URLSearchParams(url.split('?')[1] ?? '').get(name);

function batchUrl(base: string, waiting: Waiting[]): string {
  const byId = new Map(waiting.map((w) => [w.id, w.url]));
  const ids = [...byId.keys()];
  const at = [...byId.values()].map((u) => paramOf(u, 'revision'));
  const orgs = new Set([...byId.values()].map((u) => paramOf(u, 'org')));
  const org = orgs.size === 1 ? [...orgs][0] : null;
  const held = at.every(Boolean) && org ? `&at=${at.join(',')}&org=${org}` : '';
  return `${base}/sources?ids=${ids.join(',')}${held}`;
}

function frameBatcher(fetcher: Fetcher): Fetcher {
  const queues = new Map<string, Waiting[]>();

  const ask = async (base: string, waiting: Waiting[]) => {
    markStartup(StartupStep.SourcesAsked);
    const batch = await fetcher(batchUrl(base, waiting))
      .then((res) => (res.ok ? (res.json() as Promise<Batch>) : null))
      .catch(() => null);
    markStartup(StartupStep.SourcesArrived);

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

const NOTHING = { ok: false, status: HTTP_NO_CONTENT, json: async () => null } as unknown as Response;

function cacheKeyOf(url: string): { key: string; revision: number } | null {
  const match = FRAME_SOURCE.exec(url);
  const revision = Number(paramOf(url, 'revision'));
  const look = paramOf(url, 'look');
  const canvasId = match?.[1].split('/')[4];
  if (!match || !canvasId || !look || !Number.isInteger(revision) || revision <= 0) {
    return null;
  }
  return { key: keptKey({ canvasId, nodeId: match[2], revision, look, linked: paramOf(url, 'linked') ?? '' }), revision };
}

const forCache = ({ addresses, ...source }: FrameDoc): FrameDoc => ({ ...source, assets: addresses ?? source.assets });

function cached(fetcher: Fetcher, cacheOf: () => FrameCache | null): Fetcher {
  return async (url, init) => {
    const cache = cacheOf();
    const asked = cache ? cacheKeyOf(url) : null;
    if (!cache || !asked) {
      return fetcher(url, init);
    }

    const held = await cache.take(asked.key).catch(() => null);
    if (held) {
      return answered(held);
    }

    const res = await fetcher(url, init);
    const source = res.ok && res.status !== HTTP_NO_CONTENT ? ((await res.json().catch(() => null)) as FrameDoc | null) : null;
    if (!source) {
      return NOTHING;
    }
    if (source.revision === asked.revision) {
      void cache.keep(asked.key, forCache(source)).catch(() => undefined);
    }
    return answered(source);
  };
}

export const batchedSources = (fetcher: Fetcher, kept = SOURCES_KEPT, cacheOf: () => FrameCache | null = () => null): ReadSource => sourceReader(cached(frameBatcher(fetcher), cacheOf), kept);

let scoped: FrameCache | null = null;

export function scopeFrameCache(scope: CacheScope | null): FrameCache | null {
  scoped = scopedCache(scope);
  return scoped;
}

export const scopedFrames = (): FrameCache | null => scoped;

export const frameSources = batchedSources((url, init) => fetch(url, { cache: 'no-cache', ...init }), SOURCES_KEPT, () => scoped);
