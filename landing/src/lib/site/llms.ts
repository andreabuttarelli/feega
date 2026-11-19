import { FAQ } from './home';
import { LANDING_PAGES } from './landing';
import { UPSCALER } from './landing/upscaler';
import { CODEBASE, CODEBASE_PATH } from './codebase';
import { HOME_META, PRICING_META } from './seo';
import { COFFEE_URL, EDITORS, EXTENSION_PUBLISHED, GITHUB_URL, SITE_URL } from './links';
import { PRICING_PATH, SITE_PATHS } from './paths';
import { LEGAL_DOCS } from './legal';
import { ALTERNATIVES, ALTERNATIVES_INDEX, ALTERNATIVES_PATH, alternativePath } from './alternatives';
import { COMPARE_INDEX, COMPARE_PATH, COMPARISONS, comparisonPath } from './compare';
import { GUIDES, GUIDES_INDEX, GUIDES_PATH, guidePath } from './guides';
import { plainText } from './text';

const SUMMARY = 'Feega is a free, open-source (Apache-2.0) VS Code extension to design in your codebase: click any element of your running app, edit it like in Figma, and the change is written to your code. No AI, no tokens, with diffs. React, Next.js, SvelteKit and Vue, with Tailwind or plain CSS. Works in VS Code, Cursor, Windsurf and VSCodium. Feega Cloud (GitHub sync, collaboration, sections and templates) is coming later.';

const INSTALL_LINES = EXTENSION_PUBLISHED
  ? EDITORS.map((e) => `- [${e.label}](${e.installUrl})`)
  : [`- Not published yet. Follow on [GitHub](${GITHUB_URL}) or [support with a coffee](${COFFEE_URL}).`];

export const PAGE_TITLES: Record<string, string> = {
  '/': HOME_META.title,
  [PRICING_PATH]: PRICING_META.title,
  '/changelog': 'Changelog',
  '/ai-video-upscaler': UPSCALER.title,
  [CODEBASE_PATH]: CODEBASE.title,
  [COMPARE_PATH]: COMPARE_INDEX.title,
  [ALTERNATIVES_PATH]: ALTERNATIVES_INDEX.title,
  [GUIDES_PATH]: GUIDES_INDEX.title,
  ...Object.fromEntries(Object.entries(GUIDES).map(([slug, g]) => [guidePath(slug), g.title])),
  ...Object.fromEntries(Object.entries(COMPARISONS).map(([slug, c]) => [comparisonPath(slug), c.title])),
  ...Object.fromEntries(Object.entries(ALTERNATIVES).map(([slug, a]) => [alternativePath(slug), a.title])),
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
    '## Install',
    INSTALL_LINES.join('\n'),
    '## Source',
    `- [GitHub](${GITHUB_URL}): source code and README`,
    `- [Full text](${SITE_URL}/llms-full.txt): this file with the complete FAQ`
  ].join('\n\n') + '\n';

export const llmsFullTxt = () =>
  [
    '# feega',
    `> ${SUMMARY}`,
    '## Guides',
    Object.entries(GUIDES).map(([slug, g]) => `### ${g.heading}\n${g.answer}\n${SITE_URL}${guidePath(slug)}`).join('\n\n'),
    '## FAQ',
    FAQ.map((f) => `### ${f.q}\n${plainText(f.a)}`).join('\n\n'),
    '## Pages',
    SITE_PATHS.map(link).join('\n')
  ].join('\n\n') + '\n';
