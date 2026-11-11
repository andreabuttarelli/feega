import { createHash } from 'node:crypto';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { serverTiming, type Phases } from '$lib/server/server-timing';

const HTTP_NOT_MODIFIED = 304;
const REVALIDATE = 'private, no-cache';
const BROTLI_QUALITY = 4;
const PACKED_KEPT = 32;

enum Encoding {
  Brotli = 'br',
  Gzip = 'gzip'
}

const PACK: Record<Encoding, (body: string) => Buffer> = {
  [Encoding.Brotli]: (body) => brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } }),
  [Encoding.Gzip]: (body) => gzipSync(body)
};

function encodingOf(request: Request): Encoding | null {
  const accepted = (request.headers.get('accept-encoding') ?? '').split(',').map((e) => e.trim().split(';')[0]);
  return Object.values(Encoding).find((e) => accepted.includes(e)) ?? null;
}

const packedBodies = new Map<string, Buffer>();

function packOnce(tag: string, encoding: Encoding, body: string): Buffer {
  const key = `${encoding}${tag}`;
  const known = packedBodies.get(key);
  if (known) {
    return known;
  }

  const packed = PACK[encoding](body);
  packedBodies.set(key, packed);
  if (packedBodies.size > PACKED_KEPT) {
    packedBodies.delete(packedBodies.keys().next().value!);
  }
  return packed;
}

export function revalidated(request: Request, body: string, phases: Phases = serverTiming()): Response {
  const tag = phases.span('etag', () => `"${createHash('sha1').update(body).digest('base64url')}"`);
  const headers = () => ({ etag: tag, 'cache-control': REVALIDATE, vary: 'accept-encoding', 'server-timing': phases.header() });
  if (request.headers.get('if-none-match') === tag) {
    return new Response(null, { status: HTTP_NOT_MODIFIED, headers: headers() });
  }

  const encoding = encodingOf(request);
  if (!encoding) {
    return new Response(body, { headers: { ...headers(), 'content-type': 'application/json' } });
  }
  const packed = phases.span('compress', () => packOnce(tag, encoding, body));
  return new Response(new Uint8Array(packed), { headers: { ...headers(), 'content-type': 'application/json', 'content-encoding': encoding } });
}
