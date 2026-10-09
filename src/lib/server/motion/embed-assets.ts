import { createHash } from 'node:crypto';

const INLINED = /data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)/g;
const KEEP_INLINE_CHARS = 2048;
const HASH_CHARS = 16;

export type HostedAsset = { type: string; bytes: Uint8Array<ArrayBuffer> };

const hashOf = (uri: string) => createHash('sha256').update(uri).digest('hex').slice(0, HASH_CHARS);

export function hostAssets(page: string, base: string): string {
  return page.replace(INLINED, (uri) => (uri.length < KEEP_INLINE_CHARS ? uri : `${base}/${hashOf(uri)}`));
}

export function assetOf(page: string, hash: string): HostedAsset | null {
  for (const match of page.matchAll(INLINED)) {
    if (match[0].length >= KEEP_INLINE_CHARS && hashOf(match[0]) === hash) {
      return { type: match[1], bytes: Uint8Array.from(Buffer.from(match[2], 'base64')) };
    }
  }
  return null;
}
