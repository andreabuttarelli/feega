import { FAQ } from './home';
import { CODEBASE, CODEBASE_PATH } from './codebase';
import { DOWNLOAD_META, HOME_META, PRICING_META } from './seo';
import { COFFEE_URL, DOWNLOAD_PATH, EDITORS, EXTENSION_PUBLISHED, GITHUB_URL, SITE_URL } from './links';
import { PRICING_PATH, SITE_PATHS } from './paths';
import { LEGAL_DOCS } from './legal';
import { ALTERNATIVES, ALTERNATIVES_INDEX, ALTERNATIVES_PATH, alternativePath } from './alternatives';
import { plainText } from './text';
import type { Crumb } from './structured-data';
import { HUBS } from './topics';
import { topicPath } from './topics/topic';

const SUMMARY = 'Feega is a free, open-source (Apache-2.0) VS Code extension to design in your codebase: click any element of your running app, edit it like in Figma, and the change is written to your code. No AI, no tokens, with diffs and undo. React, Next.js, SvelteKit and Vue, with Tailwind or plain CSS. Works in VS Code, Cursor, Windsurf and VSCodium on macOS, Windows and Linux, or in the browser with npx feega. Feega Cloud (GitHub sync, collaboration, sections and templates) is coming later.';

const HOW_IT_WORKS = [
  '- Run "Feega: Open from current workspace" in the command palette, or `npx feega` in the app folder. Feega starts your dev server and opens the app beside your code.',
  '- In development only, Feega tags each element with the file, line and column it came from, so a click on the page lands on a line of source.',
  '- Edit text, spacing, size, layout, colour, radius, shadows and typography in the right bar, at full, desktop, tablet or phone width.',
  '- Every edit is a file change you can review in Changes and undo. Nothing is sent to a model and no account is needed.'
].join('\n');

const WRITES = [
  '- Tailwind projects: the matching utility class in the element\'s class or className, or your own theme token when one matches. At a smaller preview width it changes the class that applies at that width, so md:p-8 stays md: and p-4 stays the base.',
  '- Svelte and Vue without Tailwind: a rule in the component\'s <style> block.',
  '- React and Next.js without Tailwind: a rule in a CSS module next to the component, imported if it was not.',
  '- Not written: class names built by an expression (cn(), clsx(), template strings), and text that comes from data rather than markup. Feega says why and points at the line.'
].join('\n');

const INSTALL_LINES = EXTENSION_PUBLISHED
  ? EDITORS.map((e) => `- [${e.label}](${e.installUrl})`)
  : [`- Not published yet. Follow on [GitHub](${GITHUB_URL}) or [support with a coffee](${COFFEE_URL}).`];

export const PAGE_TITLES: Record<string, string> = {
  '/': HOME_META.title,
  [PRICING_PATH]: PRICING_META.title,
  [DOWNLOAD_PATH]: DOWNLOAD_META.title,
  '/changelog': 'Changelog',
  [CODEBASE_PATH]: CODEBASE.title,
  [ALTERNATIVES_PATH]: ALTERNATIVES_INDEX.title,
  ...Object.fromEntries(HUBS.map((h) => [h.path, h.title])),
  ...Object.fromEntries(HUBS.flatMap((h) => Object.entries(h.topics).map(([slug, t]) => [topicPath(h, slug), t.title]))),
  ...Object.fromEntries(Object.entries(ALTERNATIVES).map(([slug, a]) => [alternativePath(slug), a.title])),
  ...Object.fromEntries(Object.entries(LEGAL_DOCS).map(([slug, d]) => [`/${slug}`, d.title]))
};

export const pageTitle = (path: string): string | undefined => PAGE_TITLES[path];

const prefixesOf = (path: string) => path.split('/').filter(Boolean).map((_, i, parts) => `/${parts.slice(0, i + 1).join('/')}`);

export const trailOf = (path: string): Crumb[] => prefixesOf(path).flatMap((p) => (PAGE_TITLES[p] ? [{ name: PAGE_TITLES[p], path: p }] : []));

const link = (path: string) => `- [${PAGE_TITLES[path]}](${SITE_URL}${path === '/' ? '' : path})`;

export const llmsTxt = () =>
  [
    '# Feega',
    `> ${SUMMARY}`,
    '## How it works',
    HOW_IT_WORKS,
    '## What it writes to your code',
    WRITES,
    '## Pages',
    SITE_PATHS.map(link).join('\n'),
    '## Install',
    INSTALL_LINES.join('\n'),
    '## Source',
    `- [GitHub](${GITHUB_URL}): source code and README`,
    `- [Docs](https://docs.feega.app): setup and reference`,
    `- [Docs for LLMs](https://docs.feega.app/llms.txt): every docs page, also as one file at https://docs.feega.app/llms-full.txt`,
    `- [Full text](${SITE_URL}/llms-full.txt): this file with the complete FAQ`,
    '## Contact',
    '- hi@feega.app for general questions, support@feega.app for help'
  ].join('\n\n') + '\n';

export const llmsFullTxt = () =>
  [
    '# Feega',
    `> ${SUMMARY}`,
    '## How it works',
    HOW_IT_WORKS,
    '## What it writes to your code',
    WRITES,
    ...HUBS.flatMap((h) => [`## ${h.heading}`, Object.entries(h.topics).map(([slug, t]) => `### ${t.heading}\n${t.short}\n${SITE_URL}${topicPath(h, slug)}`).join('\n\n')]),
    '## FAQ',
    FAQ.map((f) => `### ${f.q}\n${plainText(f.a)}`).join('\n\n'),
    '## Pages',
    SITE_PATHS.map(link).join('\n')
  ].join('\n\n') + '\n';
