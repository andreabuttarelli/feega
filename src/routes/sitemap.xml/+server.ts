import type { RequestHandler } from './$types';
import { siteUrl, MARKETING_PATHS, STATIC_SITEMAP_PATHS } from '$lib/seo';
import { hideMarketing } from '$lib/server/marketing-shell';

export const GET: RequestHandler = async ({ url }) => {
  const site = siteUrl(url.origin);
  const loc = (p: string) => site + (p === '/' ? '/' : p);
  const appOnly = hideMarketing();

  const marketingEntries = appOnly
    ? []
    : MARKETING_PATHS.map(
        (path) => `  <url>
    <loc>${loc(path)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
      );

  const staticEntries = appOnly
    ? []
    : STATIC_SITEMAP_PATHS.map(
        (path) => `  <url>
    <loc>${loc(path)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`
      );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${marketingEntries.join('\n')}
${staticEntries.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
