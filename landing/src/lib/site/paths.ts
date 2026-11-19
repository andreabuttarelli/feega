import { DOWNLOAD_PATH } from './links';
import { LEGAL_DOCS } from './legal';
import { CODEBASE_PATH } from './codebase';
import { ALTERNATIVES, ALTERNATIVES_PATH, alternativePath } from './alternatives';

export const PRICING_PATH = '/pricing';

export const SITE_PATHS: readonly string[] = [
  '/',
  PRICING_PATH,
  DOWNLOAD_PATH,
  '/changelog',
  CODEBASE_PATH,
  ALTERNATIVES_PATH,
  ...Object.keys(ALTERNATIVES).map(alternativePath),
  ...Object.keys(LEGAL_DOCS).map((slug) => `/${slug}`)
];
