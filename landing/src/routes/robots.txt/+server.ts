import { SITE_URL } from '$lib/site/links';

export const prerender = true;

export function GET(): Response {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
}
