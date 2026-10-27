import { LANDING_PAGES } from './landing';
import { LEGAL_DOCS } from './legal';

export const SITE_PATHS: readonly string[] = [
  '/',
  '/changelog',
  '/ai-video-upscaler',
  ...Object.keys(LANDING_PAGES).map((slug) => `/${slug}`),
  ...Object.keys(LEGAL_DOCS).map((slug) => `/${slug}`)
];
