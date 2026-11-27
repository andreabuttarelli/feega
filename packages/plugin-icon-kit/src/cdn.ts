export type Source = { name: string; version: string };

export type Reply = { status: number; text: string };

export const CDN_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com'];

export const OFFLINE_NOTE = 'Icons need internet the first time.';

const OK = 200;
const SVG_START = /^\s*(<!--[\s\S]*?-->\s*)*<svg[\s>]/;
const COMMENT = /<!--[\s\S]*?-->/g;
const OPENING_TAG = /^\s*<svg[^>]*>/;
const CLOSING_TAG = /<\/svg>\s*$/;
const LINE_BREAKS = /\s*\n\s*/g;

export const cdnUrls = (source: Source, path: string): string[] => [`https://cdn.jsdelivr.net/npm/${source.name}@${source.version}/${path}`, `https://unpkg.com/${source.name}@${source.version}/${path}`];

export const innerOf = (svg: string): string => svg.replace(COMMENT, '').replace(OPENING_TAG, '').replace(CLOSING_TAG, '').replace(LINE_BREAKS, '').trim();

export function iconFetcher(fetchText: (url: string) => Promise<Reply>, source: Source) {
  const cache = new Map<string, string>();
  const pending = new Map<string, Promise<string | null>>();

  async function download(path: string): Promise<string | null> {
    for (const url of cdnUrls(source, path)) {
      const text = await fetchText(url).then((reply) => (reply.status === OK && SVG_START.test(reply.text) ? reply.text : null), () => null);
      if (text !== null) {
        cache.set(path, text);
        return text;
      }
    }
    return null;
  }

  function get(path: string): Promise<string | null> {
    const known = cache.get(path);
    if (known !== undefined) {
      return Promise.resolve(known);
    }
    const running = pending.get(path) ?? download(path).finally(() => pending.delete(path));
    pending.set(path, running);
    return running;
  }

  return { get, cached: (path: string): string | undefined => cache.get(path) };
}
