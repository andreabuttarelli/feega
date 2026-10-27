import { FAQ } from './home';
import { LANDING_PAGES } from './landing';
import { UPSCALER } from './landing/upscaler';
import { HOME_META } from './seo';
import { APP_URL, GITHUB_URL, SITE_URL } from './links';
import { SITE_PATHS } from './paths';
import { LEGAL_DOCS } from './legal';
import { plainText } from './text';

const SUMMARY = 'feega is an open-source (Apache-2.0) infinite canvas where people and AI agents design, animate and generate together: frames, motion, images, video, audio and text as connected nodes. It runs locally from one .feega file with no account, or in the cloud at ' + APP_URL + '.';

export const PAGE_TITLES: Record<string, string> = {
  '/': HOME_META.title,
  '/changelog': 'Changelog',
  '/ai-video-upscaler': UPSCALER.title,
  ...Object.fromEntries(Object.entries(LANDING_PAGES).map(([slug, p]) => [`/${slug}`, p.title])),
  ...Object.fromEntries(Object.entries(LEGAL_DOCS).map(([slug, d]) => [`/${slug}`, d.title]))
};

export const pageTitle = (path: string): string | undefined => PAGE_TITLES[path];

const link = (path: string) => `- [${PAGE_TITLES[path]}](${SITE_URL}${path === '/' ? '' : path})`;

export const llmsTxt = () =>
  [
    '# feega',
    `> ${SUMMARY}`,
    '## Pages',
    SITE_PATHS.map(link).join('\n'),
    '## Source and app',
    `- [GitHub](${GITHUB_URL}): source code, README and local run instructions`,
    `- [App](${APP_URL}): sign up or log in`,
    `- [Full text](${SITE_URL}/llms-full.txt): this file with the complete FAQ`
  ].join('\n\n') + '\n';

export const llmsFullTxt = () =>
  [
    '# feega',
    `> ${SUMMARY}`,
    '## Run it with your agent',
    `git clone ${GITHUB_URL} && cd feega && npm install\nnpm run local -- my-canvas.feega`,
    '## FAQ',
    FAQ.map((f) => `### ${f.q}\n${plainText(f.a)}`).join('\n\n'),
    '## Pages',
    SITE_PATHS.map(link).join('\n')
  ].join('\n\n') + '\n';
