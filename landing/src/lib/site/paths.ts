import { LANDING_PAGES } from './landing';
import { LEGAL_DOCS } from './legal';
import { GUIDES, GUIDES_PATH, guidePath } from './guides';
import { COMPARE_PATH, COMPARISONS, comparisonPath } from './compare';
import { CODEBASE_PATH } from './codebase';
import { ALTERNATIVES, ALTERNATIVES_PATH, alternativePath } from './alternatives';

export const PRICING_PATH = '/pricing';

export const SITE_PATHS: readonly string[] = [
  '/',
  PRICING_PATH,
  '/changelog',
  '/ai-video-upscaler',
  CODEBASE_PATH,
  COMPARE_PATH,
  ALTERNATIVES_PATH,
  GUIDES_PATH,
  ...Object.keys(GUIDES).map(guidePath),
  ...Object.keys(COMPARISONS).map(comparisonPath),
  ...Object.keys(ALTERNATIVES).map(alternativePath),
  ...Object.keys(LANDING_PAGES).map((slug) => `/${slug}`),
  ...Object.keys(LEGAL_DOCS).map((slug) => `/${slug}`)
];
