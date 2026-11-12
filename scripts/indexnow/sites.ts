const KEY = '8f424a739f02a60b6f86aebfe2bb540b';

export type Site = { host: string; sitemap: string; key: string };

export const SITES: Readonly<Record<string, Site>> = {
  'feega-landing': { host: 'feega.app', sitemap: 'https://feega.app/sitemap.xml', key: KEY },
  'web-blog': { host: 'blog.feega.app', sitemap: 'https://blog.feega.app/sitemap-index.xml', key: KEY },
  'web-docs': { host: 'docs.feega.app', sitemap: 'https://docs.feega.app/sitemap-index.xml', key: KEY }
};
