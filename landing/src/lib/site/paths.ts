import { DOWNLOAD_PATH } from './links';
import { PLUGINS, PLUGINS_PATH, pluginPath } from './plugins/plugins';
import { LEGAL_DOCS } from './legal';
import { CODEBASE_PATH } from './codebase';
import { HUBS } from './topics';
import { topicPath } from './topics/topic';
import { TEMPLATE_PATHS } from './templates';
import { ALTERNATIVES, ALTERNATIVES_PATH, alternativePath } from './alternatives';

export const PRICING_PATH = '/pricing';

const pluginPaths = [PLUGINS_PATH, ...PLUGINS.map((p) => pluginPath(p.id))];

export const SITE_PATHS: readonly string[] = [
  '/',
  PRICING_PATH,
  ...pluginPaths,
  DOWNLOAD_PATH,
  '/changelog',
  CODEBASE_PATH,
  ALTERNATIVES_PATH,
  ...Object.keys(ALTERNATIVES).map(alternativePath),
  ...TEMPLATE_PATHS,
  ...HUBS.flatMap((h) => [h.path, ...Object.keys(h.topics).map((slug) => topicPath(h, slug))]),
  ...Object.keys(LEGAL_DOCS).map((slug) => `/${slug}`)
];
