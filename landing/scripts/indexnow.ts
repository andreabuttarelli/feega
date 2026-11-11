import { batches, sitemapUrls } from './sitemap-urls.ts';

const HOST = 'feega.app';
const KEY = '8f424a739f02a60b6f86aebfe2bb540b';
const SITEMAP = `https://${HOST}/sitemap.xml`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10000;

const sitemap = await fetch(SITEMAP);
if (!sitemap.ok) {
  console.error(`sitemap ${sitemap.status}`);
  process.exit(1);
}

const urls = sitemapUrls(await sitemap.text());

for (const urlList of batches(urls, MAX_URLS_PER_REQUEST)) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList })
  });
  console.log(`indexnow ${res.status} ${urlList.length} urls`);
  if (!res.ok) {
    process.exit(1);
  }
}
