import { createHash } from 'node:crypto';

const HTTP_NOT_MODIFIED = 304;
const REVALIDATE = 'private, no-cache';

export function revalidated(request: Request, body: string): Response {
  const tag = `"${createHash('sha1').update(body).digest('base64url')}"`;
  const headers = { etag: tag, 'cache-control': REVALIDATE };
  if (request.headers.get('if-none-match') === tag) {
    return new Response(null, { status: HTTP_NOT_MODIFIED, headers });
  }
  return new Response(body, { headers: { ...headers, 'content-type': 'application/json' } });
}
