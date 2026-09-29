import type { Db } from '$lib/server/db/client';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import type { StoredMedia } from './paid-ads';

const ABSOLUTE_URL = /^https?:\/\//;
const GENERATED_SOURCE = 'generated';

export function providerMediaSigner(userDb: Db) {
  return async (media: StoredMedia[]): Promise<Map<string, string>> => {
    const absolute = media.filter((m) => ABSOLUTE_URL.test(m.path));
    const stored = media.filter((m) => !ABSOLUTE_URL.test(m.path));
    const signed = stored.length
      ? await signAssetPaths(userDb, createAssetSigningDb(), {
          generated: stored.filter((m) => m.source === GENERATED_SOURCE).map((m) => m.path),
          uploaded: stored.filter((m) => m.source !== GENERATED_SOURCE).map((m) => m.path)
        })
      : new Map<string, string>();
    for (const m of absolute) {
      signed.set(m.path, m.path);
    }
    return signed;
  };
}
