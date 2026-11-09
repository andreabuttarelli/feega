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

export const frameSources = sourceReader((url) => fetch(url, { cache: 'no-cache' }));
