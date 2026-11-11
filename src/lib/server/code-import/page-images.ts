import type { PageAsk } from '$lib/server/url-import/import-url';

const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const IMAGE_MAX_BYTES = 15_000_000;

type ImportImage = PageAsk['importImage'];

export function ownImages(importImage: ImportImage, pages: string[]): ImportImage {
  const origins = new Set(pages.map((page) => new URL(page).origin));

  return async (url) => {
    if (!URL.canParse(url) || !origins.has(new URL(url).origin)) {
      return importImage(url);
    }

    const answer = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) }).catch(() => null);
    const mime = answer?.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!answer?.ok || !mime.startsWith('image/')) {
      return null;
    }

    const bytes = Buffer.from(await answer.arrayBuffer());
    if (bytes.length > IMAGE_MAX_BYTES) {
      return null;
    }

    return importImage(`data:${mime};base64,${bytes.toString('base64')}`);
  };
}
