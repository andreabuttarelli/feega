export type StorageTarget = { url: string; apiKey: string; bucket: string };
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const HTTP_TOO_LARGE = 413;
const UNDER_LIMIT = new Set([400, 401, 403]);
const LARGEST_PROBED = 2 ** 40;
const PROBE_OBJECT = 'upload-limit-probe';
const TUS_VERSION = '1.0.0';
const CACHE_MS = 60 * 60_000;

async function tooLarge(target: StorageTarget, bytes: number, fetcher: Fetcher): Promise<boolean> {
  const metadata = `bucketName ${btoa(target.bucket)},objectName ${btoa(PROBE_OBJECT)}`;
  const response = await fetcher(`${target.url}/storage/v1/upload/resumable`, {
    method: 'POST',
    headers: { 'tus-resumable': TUS_VERSION, 'upload-length': String(bytes), 'upload-metadata': metadata, apikey: target.apiKey }
  });
  if (response.status === HTTP_TOO_LARGE) {
    return true;
  }
  if (UNDER_LIMIT.has(response.status)) {
    return false;
  }
  throw new Error(`upload limit probe: storage answered ${response.status}`);
}

export async function probeUploadLimit(target: StorageTarget, fetcher: Fetcher = fetch): Promise<number> {
  let fits = 0;
  let refused = LARGEST_PROBED;
  while (refused - fits > 1) {
    const mid = Math.floor((fits + refused) / 2);
    if (await tooLarge(target, mid, fetcher)) {
      refused = mid;
    } else {
      fits = mid;
    }
  }
  return fits;
}

let cached: { at: number; limit: Promise<number> } | null = null;

export function uploadLimit(target: StorageTarget): Promise<number> {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.limit;
  }
  const limit = probeUploadLimit(target).catch((e) => {
    cached = null;
    throw e;
  });
  cached = { at: Date.now(), limit };
  return limit;
}
