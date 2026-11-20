export const DOCS_SITE = 'https://docs.feega.app';
const SITE_HOME = 'https://www.feega.app';
const GITHUB = 'https://github.com/andreabuttarelli/feega';
const SKILL_INSTALL = 'npx skills add andreabuttarelli/feega';
const PLUGIN_INSTALL = '/plugin install feega --marketplace andreabuttarelli/feega';
const SUMMARY =
  'Feega is a free, open-source VS Code extension and `npx feega` to design in your codebase: click any element of your running app, edit it like in Figma, and the change is written to your source as a diff. No AI, no tokens.';

const SECTION_TITLES = {
  '': 'Overview',
  'getting-started': 'Getting started',
  editing: 'Editing',
  frameworks: 'Frameworks',
  styling: 'Styling systems',
  integrations: 'Integrations',
  more: 'More'
};
const SECTION_ORDER = Object.keys(SECTION_TITLES);

/** @typedef {{ id: string, title: string, description: string, body: string }} DocPage */

const sectionOf = (id) => (id.includes('/') ? id.split('/')[0] : '');

export const pageUrl = (id) => `${DOCS_SITE}/${id === 'index' ? '' : `${id.replace(/\/index$/, '')}/`}`;

const sorted = (pages) =>
  [...pages].sort((a, b) => SECTION_ORDER.indexOf(sectionOf(a.id)) - SECTION_ORDER.indexOf(sectionOf(b.id)) || a.id.localeCompare(b.id));

const entry = (p) => `- [${p.title}](${pageUrl(p.id)})${p.description ? `: ${p.description}` : ''}`;

const sectionBlock = (key, pages) => {
  const members = pages.filter((p) => sectionOf(p.id) === key);
  return members.length ? `## ${SECTION_TITLES[key]}\n\n${members.map(entry).join('\n')}` : '';
};

export const llmsTxt = (pages) =>
  [
    '# Feega docs',
    `> ${SUMMARY}`,
    ...SECTION_ORDER.map((key) => sectionBlock(key, pages)).filter(Boolean),
    [
      '## Links',
      '',
      `- [Feega website](${SITE_HOME}): product, download and pricing`,
      `- [GitHub](${GITHUB}): source code, Apache-2.0`,
      `- [Full docs as one file](${DOCS_SITE}/llms-full.txt): every page below in Markdown`
    ].join('\n'),
    ['## Use Feega with your AI agent', '', `- Skill: \`${SKILL_INSTALL}\``, `- Claude Code: \`${PLUGIN_INSTALL}\``].join('\n')
  ].join('\n\n') + '\n';

export const llmsFullTxt = (pages) =>
  sorted(pages)
    .map((p) => `# ${p.title}\n${pageUrl(p.id)}\n\n${p.body}`)
    .join('\n\n---\n\n') + '\n';
