import type { RequestHandler } from './$types';

const BODY = `User-agent: *
Disallow: /
`;

export const GET: RequestHandler = () =>
  new Response(BODY, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
