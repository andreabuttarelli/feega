import type { PageAsk } from '$lib/server/url-import/import-url';
import { readAllOrReject } from '$lib/server/tool-guard';

const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const IMAGE_MAX_BYTES = 15_000_000;
const IMAGE_MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type ImportImage = PageAsk['importImage'];

async function fetchOwn(url: string, origins: Set<string>, signal: AbortSignal): Promise<Response | null> {
  let target = url;

  for (let hop = 0; hop <= IMAGE_MAX_REDIRECTS; hop++) {
    const answer = await fetch(target, { signal, redirect: 'manual' }).catch(() => null);
    if (!answer || !REDIRECT_STATUSES.has(answer.status)) {
      return answer;
    }

    const location = answer.headers.get('location');
    await answer.body?.cancel().catch(() => {});
    const next = location && URL.canParse(location, target) ? new URL(location, target) : null;
    if (!next || !origins.has(next.origin)) {
      return null;
    }

    target = next.href;
  }

  return null;
}

export function ownImages(importImage: ImportImage, pages: string[]): ImportImage {
  const origins = new Set(pages.map((page) => new URL(page).origin));

  return async (url) => {
    if (!URL.canParse(url) || !origins.has(new URL(url).origin)) {
      return importImage(url);
    }

    const answer = await fetchOwn(url, origins, AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS));
    const mime = answer?.headers.get('content-type')?.split(';')[0].trim() ?? '';
    const declared = Number(answer?.headers.get('content-length') ?? 0);
    if (!answer?.ok || !mime.startsWith('image/') || declared > IMAGE_MAX_BYTES) {
      return null;
    }

    const bytes = await readAllOrReject(answer, IMAGE_MAX_BYTES).catch(() => null);
    if (!bytes) {
      return null;
    }

    return importImage(`data:${mime};base64,${bytes.toString('base64')}`);
  };
}
