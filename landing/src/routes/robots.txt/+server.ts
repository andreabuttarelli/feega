import { SITE_URL } from '$lib/site/links';
import { AI_CRAWLERS } from '$lib/site/crawlers';

export const prerender = true;

export function GET(): Response {
  return new Response(`${AI_CRAWLERS.map((bot) => `User-agent: ${bot}\nAllow: /\n`).join('\n')}\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
}
