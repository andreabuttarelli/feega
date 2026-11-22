export const SOURCES = ['tokens.css', 'chrome.css', 'SiteNav.astro', 'SiteFooter.astro', 'social.mjs'];

const CSS_DIRS = ['landing/src/lib/site/theme', 'web-docs/src/styles/theme', 'web-blog/src/styles/theme'];
const ASTRO_DIRS = ['web-docs/src/components/theme', 'web-blog/src/components/theme'];

export const dirsFor = (source) => (source.endsWith('.css') ? CSS_DIRS : ASTRO_DIRS);
