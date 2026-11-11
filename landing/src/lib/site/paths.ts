import { LANDING_PAGES } from './landing';
import { LEGAL_DOCS } from './legal';
import { GUIDES, GUIDES_PATH, guidePath } from './guides';
import { BLOG_PATH, COMPARISONS, comparisonPath } from './compare';

export const SITE_PATHS: readonly string[] = [
  '/',
  '/changelog',
  '/ai-video-upscaler',
  BLOG_PATH,
  GUIDES_PATH,
  ...Object.keys(GUIDES).map(guidePath),
  ...Object.keys(COMPARISONS).map(comparisonPath),
  ...Object.keys(LANDING_PAGES).map((slug) => `/${slug}`),
  ...Object.keys(LEGAL_DOCS).map((slug) => `/${slug}`)
];
