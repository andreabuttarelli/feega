import { SITE_URL } from './links';
import { SITE_PATHS } from './paths';
import { HUBS } from './topics';
import { topicPath } from './topics/topic';
import { ALTERNATIVES, ALTERNATIVES_PATH, alternativePath } from './alternatives';

const latest = (dates: readonly string[]): string => [...dates].sort().at(-1) ?? '';

function lastModified(): ReadonlyMap<string, string> {
  const dates = new Map<string, string>();
  const articles = Object.entries(ALTERNATIVES);

  for (const [slug, article] of articles) {
    dates.set(alternativePath(slug), article.checked);
  }
  dates.set(ALTERNATIVES_PATH, latest(articles.map(([, a]) => a.checked)));

  for (const hub of HUBS) {
    const topics = Object.entries(hub.topics);
    for (const [slug, topic] of topics) {
      dates.set(topicPath(hub, slug), topic.checked);
    }
    dates.set(hub.path, latest(topics.map(([, t]) => t.checked)));
  }

  return dates;
}

export function sitemapXml(): string {
  const dates = lastModified();

  const urls = SITE_PATHS.map((path) => {
    const lastmod = dates.get(path);
    const stamp = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
    return `  <url><loc>${SITE_URL}${path}</loc>${stamp}</url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    ''
  ].join('\n');
}
