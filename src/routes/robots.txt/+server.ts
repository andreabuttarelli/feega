import type { RequestHandler } from './$types';
import { siteUrl } from '$lib/seo';

export const GET: RequestHandler = async ({ url }) => {
  const site = siteUrl(url.origin);
  const body = `User-agent: *
Allow: /
Disallow: /app
Disallow: /api
Disallow: /auth
Disallow: /approve
Disallow: /share

Sitemap: ${site}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
