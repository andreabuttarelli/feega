import { sitemapXml } from '$lib/site/sitemap';

export const prerender = true;

export function GET(): Response {
  return new Response(sitemapXml(), { headers: { 'content-type': 'application/xml' } });
}
