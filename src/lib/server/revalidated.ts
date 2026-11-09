import { createHash } from 'node:crypto';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const HTTP_NOT_MODIFIED = 304;
const REVALIDATE = 'private, no-cache';
const BROTLI_QUALITY = 4;

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

export function revalidated(request: Request, body: string): Response {
  const tag = `"${createHash('sha1').update(body).digest('base64url')}"`;
  const headers = { etag: tag, 'cache-control': REVALIDATE, vary: 'accept-encoding' };
  if (request.headers.get('if-none-match') === tag) {
    return new Response(null, { status: HTTP_NOT_MODIFIED, headers });
  }

  const encoding = encodingOf(request);
  if (!encoding) {
    return new Response(body, { headers: { ...headers, 'content-type': 'application/json' } });
  }
  return new Response(new Uint8Array(PACK[encoding](body)), { headers: { ...headers, 'content-type': 'application/json', 'content-encoding': encoding } });
}
