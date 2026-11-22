import { CalloutTone, type Extras } from '../alternative';
import { CHANGES_SHOT, EDITOR_PROPERTIES, OVERVIEW_SHOT, SELECTED_SHOT, PROPERTIES_CROP } from './shots';
import {
  CHANGES_DOCS, CLAUDE_MEMORY, CLAUDE_SKILLS, CODEX_CLI, CODEX_REPO, CURSOR_AGENT, CURSOR_DESIGN, FEEGA_AGENTS, FRAMER_AI, FRAMER_DEVELOPERS, FRAMER_PRICING, FRAMER_PUBLISHING, PROPERTIES_DOCS, QUICK_START_DOCS, cite
} from './sources';

const DOCS_CTA = { text: 'The agent guide lists every command and what each agent can see.', label: 'Read the agent docs', href: FEEGA_AGENTS.href };
const DOWNLOAD_CTA = { text: 'Try Feega in two minutes: run npx feega in your project folder, or install the extension.', label: 'Download Feega', href: '/download' };
const NOT_STATED = 'Not stated on the pages we read';
const TABLE_HEAD = (agent: string) => ['', 'Framer', `${agent} in your repo`, 'Feega'];

export const FRAMER_CLAUDE_CODE: Extras = {
  takeaways: [
    'Framer keeps the page in a Framer project and hosts it. Claude Code and Feega edit a page that lives in your repo.',
    'Framer can be driven by Claude Code through MCP or a local CLI, but then Claude Code edits Framer, not your repo.',
    'The pages we read do not describe code export or git sync for a Framer site.',
    'Keep Framer when designers publish the site without a developer.'
  ],
  hero: EDITOR_PROPERTIES,
  tables: [
    {
      heading: 'Framer, Claude Code and Feega side by side',
      head: TABLE_HEAD('Claude Code'),
      rows: [
        ['Where the code lives', `In a Framer project, published to Framer hosting (${cite(FRAMER_PUBLISHING)})`, 'In your repo', 'In your repo'],
        ['Pricing model', `Free $0, Basic $10, Pro $30 a month, with AI credits (${cite(FRAMER_PRICING)}, 22 November 2026)`, 'Your Claude plan or API usage', 'Free, Apache-2.0'],
        ['Export and git', NOT_STATED, 'Plain git', 'Plain git; Feega never commits'],
        ['Local or cloud', 'Cloud editor and hosting', `Terminal and editor (${cite(CLAUDE_SKILLS)})`, 'Local, no account'],
        ['Agent access', `Claude Code connects through MCP or a local CLI (${cite(FRAMER_AI)})`, 'Reads and writes your files', 'Shows the selected element’s source'],
        ['Fits', 'Designer-owned marketing sites', 'Writing and refactoring code', 'Hand edits on code that exists']
      ],
      callout: { tone: CalloutTone.Note, title: 'Dated figures', text: 'Plans and credits are as listed on Framer’s pricing page on 22 November 2026. Plans change, so read the page again before you buy.' }
    }
  ],
  sections: [
    {
      heading: 'Claude Code can drive Framer, and that is a different job',
      html: `<p>${cite(FRAMER_AI)} says Framer MCP connects tools like Claude to your projects so they can create pages, edit content and manage CMS collections, and it describes a local CLI setup as an alternative. ${cite(FRAMER_DEVELOPERS)} lists Claude Code, Codex and Cursor as external agents that update a Framer project.</p><p>In both cases the output lands in Framer. If your landing page is a Svelte, Next.js or Vue file in the same repo as the app, that route adds a second home for it. The better question is whether the page should live in the repo at all. If yes, <a href="/alternatives/framer">the Framer overview</a> explains what changes.</p>`,
      image: CHANGES_SHOT,
      callout: { tone: CalloutTone.Tip, title: 'Tip', text: 'Decide who edits the page next quarter. If the answer is a developer with Claude Code, keep it in the repo.' }
    },
    {
      heading: 'Moving the page: a checklist for Claude Code',
      html: `<p>None of the Framer pages we read describe a code export, so treat the move as a rebuild. Keep the Framer site live and ask Claude Code to build each section from a screenshot and the copy. Give it your tokens first, from your own stylesheet, so the new page uses real variables instead of copied hex values.</p><p>Per ${cite(CLAUDE_MEMORY)}, put the rule in <code>CLAUDE.md</code> that class names stay literal on elements people will tweak. When the section exists, open it in Feega and fix the spacing and type by eye, then check <a href="${CHANGES_DOCS}" rel="noopener">Changes</a>. Framer’s own ${cite(FRAMER_PUBLISHING)} page describes a reverse proxy for putting a Framer site behind your host, which is a way to keep the old page up during the move.</p>`,
      cta: DOWNLOAD_CTA
    },
    {
      heading: 'What you give up when you leave the canvas',
      html: `<p>Framer’s paid plans add a CMS, hosting locations and staging per ${cite(FRAMER_PRICING)}. Feega has none of those, and neither does Claude Code. A repo-based page needs your own hosting, your own CMS choice or Markdown files, and your own review step.</p><p>What you gain is one codebase, one history and an agent that sees all of it. The <a href="${PROPERTIES_DOCS}" rel="noopener">Properties docs</a> list the values you can set by hand, and the <a href="/pricing">pricing page</a> shows that Feega itself stays free.</p>`,
      callout: { tone: CalloutTone.Warning, title: 'Warning', text: 'If designers publish from Framer every week, a repo takes that away from them. Move only pages that already change in code.' },
      cta: DOCS_CTA
    }
  ],
  sources: [FRAMER_AI, FRAMER_PUBLISHING, CLAUDE_MEMORY]
};

export const FRAMER_CODEX: Extras = {
  takeaways: [
    'Framer lists Codex as an external agent for a Framer project. That keeps the page in Framer.',
    'Codex runs locally, in a terminal, an IDE extension or a desktop app, on files in your repo.',
    'Feega gives a terminal agent what it lacks: the running page and the exact source line.',
    'Keep Framer for designer-owned sites. Move only pages that already live in code.'
  ],
  hero: OVERVIEW_SHOT,
  tables: [
    {
      heading: 'Framer, Codex and Feega side by side',
      head: TABLE_HEAD('Codex'),
      rows: [
        ['Where the code lives', `In a Framer project (${cite(FRAMER_PUBLISHING)})`, 'In your local repo', 'In your local repo'],
        ['Pricing model', `Free $0, Basic $10, Pro $30 a month (${cite(FRAMER_PRICING)}, 22 November 2026)`, 'A ChatGPT plan or an API key', 'Free, Apache-2.0'],
        ['Export and git', NOT_STATED, 'Your git, with checkpoints advised', 'Writes files; you commit'],
        ['Local or cloud', 'Cloud editor and hosting', `CLI, IDE and desktop app are local; Codex Web is cloud (${cite(CODEX_REPO)})`, 'Local'],
        ['Agent access', `Codex through MCP or a local CLI setup (${cite(FRAMER_DEVELOPERS)})`, 'Edits files directly', 'Shows the source of the selected element'],
        ['Fits', 'Sites designers own', `Terminal work (${cite(CODEX_CLI)})`, 'Hand edits on a page in code']
      ],
      callout: { tone: CalloutTone.Note, title: 'Where Framer wins', text: 'A CMS, staging and hosting on one page, per Framer’s pricing page. Feega and Codex offer none of that.' }
    }
  ],
  sections: [
    {
      heading: 'Codex on a Framer project versus Codex on a repo',
      html: `<p>${cite(FRAMER_DEVELOPERS)} says External Agents let you connect Claude Code, Codex or Cursor to update a Framer project. ${cite(FRAMER_AI)} adds that this works through Framer MCP or a local CLI setup. Codex then changes Framer, and Framer publishes.</p><p>On a repo, ${cite(CODEX_CLI)} describes the plain version: Codex inspects the local repository, edits files and runs tools already installed on your machine. The page can use your components, your tokens and your tests. The <a href="/alternatives/framer">Framer overview</a> sets this beside the other agents.</p>`,
      callout: { tone: CalloutTone.Tip, title: 'Tip', text: 'Run /init in Codex to create an AGENTS.md, and put the literal-class rule in it.' }
    },
    {
      heading: 'A migration in four moves',
      html: `<p>First, list what the Framer page contains: sections, fonts, colors, forms, CMS content. Second, ask Codex to rebuild one section in your repo and run the app. Third, open it in Feega and set the spacing and type by eye, then read the diff in <a href="${CHANGES_DOCS}" rel="noopener">Changes</a>. Fourth, repeat per section and switch the domain when the repo version matches.</p><p>We did not find a code export on the ${cite(FRAMER_PUBLISHING)} page or the pricing page, so plan to rebuild rather than convert. Your agent guide for this setup is in the ${cite(FEEGA_AGENTS)}, and the <a href="${QUICK_START_DOCS}" rel="noopener">quick start</a> covers the first run.</p>`,
      image: EDITOR_PROPERTIES,
      cta: DOWNLOAD_CTA
    },
    {
      heading: 'Costs to compare before the move',
      html: `<p>Per ${cite(FRAMER_PRICING)}, Free is $0 with 500 AI credits a month, Basic is $10 with 1,000, and Pro is $30 with 3,000. Pro also lists branching and a staging environment. The page does not say whether those relate to git. Codex adds its own cost through a ChatGPT plan or an API key, and Feega adds none.</p><p>Moving a site means you take on hosting, so price that too. The <a href="/alternatives/framer-alternative-for-claude-code">Claude Code page</a> runs the same numbers for a different agent. Feega itself is free, as the <a href="/pricing">pricing page</a> shows.</p>`,
      callout: { tone: CalloutTone.Warning, title: 'Warning', text: 'Codex Web runs in the cloud. Feega needs your local dev server, so use the CLI, the IDE extension or the desktop app.' },
      cta: DOCS_CTA
    }
  ],
  sources: [FRAMER_AI, FRAMER_PUBLISHING, CODEX_CLI]
};

export const FRAMER_CURSOR: Extras = {
  takeaways: [
    'Framer lists Cursor as an external agent for a Framer project, so Cursor would edit Framer.',
    'In a repo, Cursor and Feega share a window: the agent pane next to the Properties bar.',
    'Cursor Design Mode sends your note to the agent. Feega writes the value you set.',
    'Keep Framer for designer-owned sites. Pages shared with your app belong in the repo.'
  ],
  hero: SELECTED_SHOT,
  tables: [
    {
      heading: 'Framer, Cursor and Feega side by side',
      head: TABLE_HEAD('Cursor'),
      rows: [
        ['Where the code lives', `In a Framer project (${cite(FRAMER_PUBLISHING)})`, 'In your workspace', 'In your workspace'],
        ['Pricing model', `Free $0, Basic $10, Pro $30 a month (${cite(FRAMER_PRICING)}, 22 November 2026)`, 'Per your Cursor plan', 'Free, Apache-2.0'],
        ['Export and git', NOT_STATED, 'Your git, with agent checkpoints', 'Writes files; you commit'],
        ['Local or cloud', 'Cloud editor and hosting', `Desktop editor (${cite(CURSOR_AGENT)})`, 'Extension in the editor, or npx feega'],
        ['Visual editing', 'Canvas in Framer', `Annotate with Design Mode (${cite(CURSOR_DESIGN)})`, 'Properties bar on your own page'],
        ['Fits', 'Designer-owned sites', 'Changes you describe', 'Changes you measure']
      ],
      callout: { tone: CalloutTone.Note, title: 'Version', text: 'Annotate needs Cursor 3.24.18 or later, per Cursor’s Design Mode page.' }
    }
  ],
  sections: [
    {
      heading: 'Cursor as a Framer agent, and Cursor as a repo agent',
      html: `<p>${cite(FRAMER_DEVELOPERS)} lists Cursor among the External Agents, and ${cite(FRAMER_AI)} says Framer MCP can create pages, edit content and manage CMS collections from tools like it. Cursor’s job there is to drive a Framer project.</p><p>With the page in a repo, ${cite(CURSOR_AGENT)} shows what the same agent can do locally: search files, edit them, run shell commands, check visual changes in a browser and restore checkpoints. That is the whole build loop without a second home for the page. The <a href="/alternatives/lovable-alternative-for-cursor">Lovable page for Cursor</a> shows the same idea with a different builder.</p>`,
      callout: { tone: CalloutTone.Tip, title: 'Tip', text: 'Add a short project rule: literal class names and visible text on elements people will tweak.' }
    },
    {
      heading: 'Using Design Mode and Feega on one page',
      html: `<p>Per ${cite(CURSOR_DESIGN)}, you annotate a running page and Cursor sends the agent your note, the element’s selector, size and key styles, and a screenshot. Use it for wording like “make the hero calmer”. For numbers you already know, open the same page with Feega, click the element and set the value in <a href="${PROPERTIES_DOCS}" rel="noopener">Properties</a>.</p><p>Both write to the same file. The ${cite(FEEGA_AGENTS)} explain that Feega reveals the selected element’s source beside it, so the agent sees the line you picked. Check each edit in <a href="${CHANGES_DOCS}" rel="noopener">Changes</a>.</p>`,
      image: PROPERTIES_CROP,
      cta: DOWNLOAD_CTA
    },
    {
      heading: 'What Framer does that Cursor and Feega do not',
      html: `<p>${cite(FRAMER_PRICING)} lists a CMS, staging, branching, localization at $20 a locale, and A/B testing as an add-on. ${cite(FRAMER_PUBLISHING)} covers hosting on a Framer subdomain or your own domain. A repo-based page has none of this built in.</p><p>If your marketing team publishes weekly from a canvas, stay on Framer. If a developer ships the page with the product, the repo is simpler. The <a href="/alternatives">alternatives index</a> lists other comparisons, and the <a href="${QUICK_START_DOCS}" rel="noopener">quick start</a> shows the first edit. Feega itself is free, as the <a href="/pricing">pricing page</a> shows.</p>`,
      callout: { tone: CalloutTone.Warning, title: 'Warning', text: 'Do not delete the Framer site before the repo page matches it. Keep both live until the domain switch.' },
      cta: DOCS_CTA
    }
  ],
  sources: [FRAMER_AI, FRAMER_PUBLISHING, CURSOR_DESIGN]
};
