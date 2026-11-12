const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//;
const REMOTE = /^https:\/\//;
const INLINE = /^data:image\//;
const INLINE_MAX_CHARS = 64_000;

function durable(url: string, publicBase: string | undefined): string | null {
  if (REMOTE.test(url) || (INLINE.test(url) && url.length <= INLINE_MAX_CHARS)) {
    return url;
  }
  const local = LOCAL.exec(url);
  return local && publicBase ? `${publicBase}${url.slice(local[0].length)}` : null;
}

export function durableImages(refs: Record<string, string>, publicBase: string | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(refs).flatMap(([key, url]) => {
    const kept = durable(url, publicBase);
    return kept ? [[key, kept]] : [];
  }));
}
