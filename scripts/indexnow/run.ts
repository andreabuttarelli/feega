import { batches, isSitemapIndex, onHost, sitemapUrls } from './sitemap-urls.ts';
import { SITES } from './sites.ts';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10000;

const site = SITES[process.argv[2] ?? ''];
if (!site) {
  console.error(`unknown site, expected one of ${Object.keys(SITES).join(', ')}`);
  process.exit(1);
}

async function read(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`${url} ${res.status}`);
    process.exit(1);
  }
  return res.text();
}

const root = await read(site.sitemap);
const pages = isSitemapIndex(root)
  ? (await Promise.all(sitemapUrls(root).map(read))).flatMap(sitemapUrls)
  : sitemapUrls(root);
const urls = onHost(pages, site.host);

for (const urlList of batches(urls, MAX_URLS_PER_REQUEST)) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: site.host, key: site.key, keyLocation: `https://${site.host}/${site.key}.txt`, urlList })
  });
  console.log(`indexnow ${site.host} ${res.status} ${urlList.length} urls`);
  if (!res.ok) {
    process.exit(1);
  }
}
