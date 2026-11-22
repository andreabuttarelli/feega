import { FAQ } from './home';
import { CODEBASE, CODEBASE_PATH } from './codebase';
import { DOWNLOAD_META, HOME_META, PLUGINS_META, PRICING_META } from './seo';
import { PLUGINS, PLUGINS_PATH, pluginPath } from './plugins/plugins';
import { COFFEE_URL, DOWNLOAD_PATH, EDITORS, EXTENSION_PUBLISHED, GITHUB_URL, SITE_URL } from './links';
import { PRICING_PATH, SITE_PATHS } from './paths';
import { LEGAL_DOCS } from './legal';
import { ALTERNATIVES, ALTERNATIVES_INDEX, ALTERNATIVES_PATH, alternativePath } from './alternatives';
import { plainText } from './text';
import type { Crumb } from './structured-data';
import { HUBS } from './topics';
import { TEMPLATE_PATHS, TEMPLATE_TITLES } from './templates';
import { TEMPLATES } from './templates/library';
import { CATEGORY_COPY, FRAMEWORK_COPY } from './templates/copy';
import { CATEGORY_SLUGS, HUB_FRAMEWORKS, TEMPLATES_PATH, categoryPath, frameworkPath, templatePath } from './templates/paths';
import type { Category } from './templates/template';
import { topicPath } from './topics/topic';

const SUMMARY = 'Feega is a free, open-source (Apache-2.0) tool to design in your codebase: click any element of your running app, edit it like in Figma, and the change is written to your code. No AI, no tokens, with diffs and undo. React, Next.js, SvelteKit, Vue, Nuxt, React Router, Astro and Vite, with Tailwind or plain CSS. Runs as a VS Code extension, or from any terminal with npx feega. Feega Cloud is coming soon.';

const SURFACES = [
  '- VS Code extension: the same editor inside VS Code, and inside VS Code-based editors Cursor, Windsurf and VSCodium. VS Code installs from the Visual Studio Marketplace; Cursor, Windsurf and VSCodium install from Open VSX. macOS, Windows and Linux.',
  '- Terminal: `npx feega` in the app folder opens the same editor in your browser, no IDE needed. It finds the app, starts its dev server and opens the editor.',
  '- Desktop app: coming soon, in beta.',
  '- Feega Cloud: coming soon, paid, €15 per editor a month (€12 a month billed annually, €144 a year), viewers free. It adds GitHub sync, collaboration, sections and templates, and all Pro templates. The extension and npx feega stay free.'
].join('\n');

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
  '- Nuxt, React Router, Astro and Vite: tested with select, text, style and structure edits. Astro and Nuxt need Feega to start the dev server. Without a framework, Vite edits land in index.html.',
  '- Not supported: Angular, plain static HTML without Vite, Create React App.',
  '- Not written: class names built by an expression (cn(), clsx(), template strings), and text that comes from data rather than markup. Feega says why and points at the line.'
].join('\n');

const INSTALL_LINES = EXTENSION_PUBLISHED
  ? EDITORS.map((e) => `- [${e.label}](${e.installUrl})`)
  : [`- Not published yet. Follow on [GitHub](${GITHUB_URL}) or [support with a coffee](${COFFEE_URL}).`];

export const PAGE_TITLES: Record<string, string> = {
  '/': HOME_META.title,
  [PRICING_PATH]: PRICING_META.title,
  [DOWNLOAD_PATH]: DOWNLOAD_META.title,
  [PLUGINS_PATH]: PLUGINS_META.title,
  ...Object.fromEntries(PLUGINS.map((p) => [pluginPath(p.id), `${p.name} plugin`])),
  '/changelog': 'Changelog',
  [CODEBASE_PATH]: CODEBASE.title,
  [ALTERNATIVES_PATH]: ALTERNATIVES_INDEX.title,
  ...TEMPLATE_TITLES,
  ...Object.fromEntries(HUBS.map((h) => [h.path, h.title])),
  ...Object.fromEntries(HUBS.flatMap((h) => Object.entries(h.topics).map(([slug, t]) => [topicPath(h, slug), t.title]))),
  ...Object.fromEntries(Object.entries(ALTERNATIVES).map(([slug, a]) => [alternativePath(slug), a.title])),
  ...Object.fromEntries(Object.entries(LEGAL_DOCS).map(([slug, d]) => [`/${slug}`, d.title]))
};

export const pageTitle = (path: string): string | undefined => PAGE_TITLES[path];

const prefixesOf = (path: string) => path.split('/').filter(Boolean).map((_, i, parts) => `/${parts.slice(0, i + 1).join('/')}`);

export const trailOf = (path: string): Crumb[] => prefixesOf(path).flatMap((p) => (PAGE_TITLES[p] ? [{ name: PAGE_TITLES[p], path: p }] : []));

const OTHER_PATHS = SITE_PATHS.filter((p) => !TEMPLATE_PATHS.includes(p));

const TEMPLATES_SUMMARY = `${TEMPLATES.length} free website sections, UI components and app screens, each in Svelte, React, Vue, Astro and HTML with --feega-* tokens, light and dark.`;

const templatesIndex = () =>
  [
    `- [${TEMPLATE_TITLES[TEMPLATES_PATH]}](${SITE_URL}${TEMPLATES_PATH}): ${TEMPLATES_SUMMARY}`,
    ...(Object.keys(CATEGORY_SLUGS) as Category[]).map((c) => `- [${CATEGORY_COPY[c].heading}](${SITE_URL}${categoryPath(c)}): ${CATEGORY_COPY[c].lead}`),
    ...HUB_FRAMEWORKS.map((f) => `- [${FRAMEWORK_COPY[f].heading}](${SITE_URL}${frameworkPath(f)}): ${FRAMEWORK_COPY[f].lead}`)
  ].join('\n');

const templatesList = () => TEMPLATES.map((t) => `- [${t.name}](${SITE_URL}${templatePath(t.id)}): ${t.description}`).join('\n');

const link = (path: string) => `- [${PAGE_TITLES[path]}](${SITE_URL}${path === '/' ? '' : path})`;

export const llmsTxt = () =>
  [
    '# Feega',
    `> ${SUMMARY}`,
    '## Where it runs',
    SURFACES,
    '## How it works',
    HOW_IT_WORKS,
    '## What it writes to your code',
    WRITES,
    '## Templates',
    templatesIndex(),
    templatesList(),
    '## Pages',
    OTHER_PATHS.map(link).join('\n'),
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
    '## Where it runs',
    SURFACES,
    '## How it works',
    HOW_IT_WORKS,
    '## What it writes to your code',
    WRITES,
    ...HUBS.flatMap((h) => [`## ${h.heading}`, Object.entries(h.topics).map(([slug, t]) => `### ${t.heading}\n${t.short}\n${SITE_URL}${topicPath(h, slug)}`).join('\n\n')]),
    '## FAQ',
    FAQ.map((f) => `### ${f.q}\n${plainText(f.a)}`).join('\n\n'),
    '## Templates',
    templatesIndex(),
    '### All templates',
    templatesList(),
    '## Pages',
    OTHER_PATHS.map(link).join('\n')
  ].join('\n\n') + '\n';
