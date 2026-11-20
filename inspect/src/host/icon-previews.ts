import { mcpIcon, type Fetcher } from './icon-search';

export const PREVIEW_CONCURRENCY = 6;
const PREVIEW_SIZE = 24;
const PREVIEW_STROKE = 2;

type Draw = (name: string, svg: string | null) => Promise<void>;

export function previewQueue(fetcher: Fetcher, draw: Draw) {
  const cache = new Map<string, Promise<string | null>>();
  const waiting: (() => void)[] = [];
  let active = 0;

  async function slot() {
    if (active >= PREVIEW_CONCURRENCY) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active++;
  }

  function release() {
    active--;
    waiting.shift()?.();
  }

  async function fetchIcon(name: string, key: string) {
    await slot();
    try {
      return await mcpIcon(fetcher, name, PREVIEW_SIZE, PREVIEW_STROKE);
    } catch {
      cache.delete(key);
      return null;
    } finally {
      release();
    }
  }

  function load(name: string) {
    const key = `${name}:${PREVIEW_SIZE}:${PREVIEW_STROKE}`;
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }
    const pending = fetchIcon(name, key);
    cache.set(key, pending);
    return pending;
  }

  return async (names: string[]) => {
    await Promise.all(names.map(async (name) => draw(name, await load(name))));
  };
}
