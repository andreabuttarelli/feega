import type { FrameDoc } from './frame-build';

const SOURCES_KEPT = 8;
const HTTP_NO_CONTENT = 204;

export type ReadSource = (url: string) => Promise<FrameDoc | null>;

export function sourceReader(fetcher: (url: string) => Promise<Response>, kept = SOURCES_KEPT): ReadSource {
  const held = new Map<string, Promise<FrameDoc | null>>();

  const keep = (url: string, reading: Promise<FrameDoc | null>) => {
    held.set(url, reading);
    if (held.size > kept) {
      held.delete(held.keys().next().value!);
    }
  };

  return (url) => {
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
        }
        return source;
      });
    keep(url, reading);
    return reading;
  };
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
type Waiting = { id: string; url: string; settle: (res: Response | Promise<Response>) => void };
type Batch = { tokens: unknown; frames: Record<string, Omit<FrameDoc, 'tokens'>> };

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
      w.settle(frame ? answered({ ...frame, tokens: batch.tokens } as FrameDoc) : fetcher(w.url));
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

export const batchedSources = (fetcher: Fetcher, kept = SOURCES_KEPT): ReadSource => sourceReader(frameBatcher(fetcher), kept);

export const frameSources = batchedSources((url, init) => fetch(url, { cache: 'no-cache', ...init }));
