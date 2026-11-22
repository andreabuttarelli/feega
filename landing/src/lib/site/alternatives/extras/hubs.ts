import { CalloutTone, type Extras } from '../alternative';
import { CHANGES_SHOT, EDITOR_PROPERTIES, OVERVIEW_SHOT, PROPERTIES_CROP } from './shots';
import {
  BLOG_POST, CHANGES_DOCS, CLAUDE_SKILLS, CODEX_CLI, CURSOR_DESIGN, FEEGA_AGENTS, FRAMER_AI, FRAMER_DEVELOPERS, FRAMER_PRICING, FRAMER_PUBLISHING, LOVABLE_GITHUB, LOVABLE_PLANS, PROPERTIES_DOCS, QUICK_START_DOCS, cite
} from './sources';

const DOCS_CTA = { text: 'The agent guide lists every command and what each agent can see.', label: 'Read the agent docs', href: FEEGA_AGENTS.href };
const DOWNLOAD_CTA = { text: 'Try Feega in two minutes: run npx feega in your project folder, or install the extension.', label: 'Download Feega', href: '/download' };

export const LOVABLE_HUB: Extras = {
  takeaways: [
    'Lovable turns a prompt into a hosted app. Its GitHub sync creates a new repository and cannot link an existing one.',
    'Commits come from lovable-dev[bot], so your history carries a bot, not only you.',
    'Feega edits the repo you already have, by hand, with no model and no credits.',
    'Keep Lovable when there is no code yet. Use your coding agent and Feega when the repo came first.'
  ],
  hero: EDITOR_PROPERTIES,
  tables: [
    {
      heading: 'Lovable, a coding agent and Feega side by side',
      head: ['', 'Lovable', 'A coding agent in your repo', 'Feega'],
      rows: [
        ['Where the code lives', `In a Lovable project, synced to a new private repository (${cite(LOVABLE_GITHUB)})`, 'In your repo', 'In your repo'],
        ['Pricing model', `Free: 5 daily build credits, capped at 30 a month. Pro from $25 a month, or $250 a year (${cite(LOVABLE_PLANS)}, 22 November 2026)`, 'Your agent’s own plan', 'Free, Apache-2.0'],
        ['Export and git', 'Upload code takes a ZIP; sync covers one branch at a time', 'Plain git, any branch', 'Plain git; Feega never commits'],
        ['Local or cloud', 'Hosted project', 'Local terminal or editor', 'Local, no account'],
        ['Who commits', 'lovable-dev[bot], sometimes crediting the member', 'You', 'You'],
        ['Who it fits', 'First versions from a prompt', 'Building and refactoring', 'Hand edits on an existing page']
      ],
      callout: { tone: CalloutTone.Note, title: 'Dated figures', text: 'Plans are as listed on Lovable’s plans page on 22 November 2026. Credits and prices can change.' }
    }
  ],
  sections: [
    {
      heading: 'What the sync does and does not do',
      html: `<p>${cite(LOVABLE_GITHUB)} spells out the rules. Connecting a project always creates a new GitHub repository, private by default. Git sync cannot link a project to an existing repository, and reconnecting after a disconnect creates yet another new one. Lovable edits one branch at a time, starting from the default branch unless you switch, and you cannot switch while it is editing.</p><p>To start from code you already have, the page says to download it as a ZIP and import it with Upload code. Business and Enterprise workspaces can record member emails on commits, per ${cite(LOVABLE_PLANS)}. None of this is a flaw for a project born in Lovable. It matters for a team whose repo came first.</p>`,
      image: PROPERTIES_CROP,
      callout: { tone: CalloutTone.Warning, title: 'Warning', text: 'Uploading a live app to change one page leaves two copies to keep in step. Try the change on a branch of your own repo first.' }
    },
    {
      heading: 'Pairing your agent with Feega on a repo',
      html: `<p>Your agent writes structure and Feega sets values. In Claude Code, ${cite(CLAUDE_SKILLS)} explains that a project skill lives in <code>.claude/skills</code> and can be committed. In Codex, ${cite(CODEX_CLI)} describes a local terminal tool. In Cursor, ${cite(CURSOR_DESIGN)} sends your annotation to the agent, while Feega sets the value yourself.</p><p>You open the running page, click an element and change it in <a href="${PROPERTIES_DOCS}" rel="noopener">Properties</a>, then read the diff in <a href="${CHANGES_DOCS}" rel="noopener">Changes</a>. The ${cite(FEEGA_AGENTS)} list which agents read the editor selection. The idea behind it is in <a href="${BLOG_POST}" rel="noopener">Design in your codebase</a>.</p>`,
      image: OVERVIEW_SHOT,
      cta: DOWNLOAD_CTA
    },
    {
      heading: 'A fair way to decide',
      html: `<p>Pick one real change from last week, such as a card padding or a heading size. Do it in Lovable and then with your own agent plus Feega. Time both, count the credits, and open the resulting diff. Feega adds no cost, so the second run is only your agent’s plan. The <a href="/pricing">pricing page</a> and the <a href="/download">download page</a> have the rest, and the <a href="${QUICK_START_DOCS}" rel="noopener">quick start</a> takes a few minutes.</p><p>Other comparisons live in the <a href="/alternatives">alternatives index</a>, including <a href="/alternatives/framer">Framer</a> for sites built on a canvas.</p>`,
      callout: { tone: CalloutTone.Tip, title: 'Tip', text: 'Judge on your repo, not on an empty project. The gap shows up on existing code.' },
      cta: DOCS_CTA
    }
  ],
  sources: [CLAUDE_SKILLS, CODEX_CLI, CURSOR_DESIGN]
};

export const FRAMER_HUB: Extras = {
  takeaways: [
    'Framer designs and hosts sites on its own canvas. The pages we read do not describe code export or git sync.',
    'Claude Code, Codex and Cursor can connect to a Framer project through MCP or a local CLI, and then they edit Framer.',
    'Feega edits a page that already lives in your repo, by hand, as a diff.',
    'Keep Framer when designers publish without a developer.'
  ],
  hero: EDITOR_PROPERTIES,
  tables: [
    {
      heading: 'Framer, a coding agent and Feega side by side',
      head: ['', 'Framer', 'A coding agent in your repo', 'Feega'],
      rows: [
        ['Where the code lives', `In a Framer project, hosted by Framer (${cite(FRAMER_PUBLISHING)})`, 'In your repo', 'In your repo'],
        ['Pricing model', `Free $0, Basic $10, Pro $30 a month, plus add-ons and AI credits (${cite(FRAMER_PRICING)}, 22 November 2026)`, 'Your agent’s own plan', 'Free, Apache-2.0'],
        ['Export and git', 'Not stated on the pages we read', 'Plain git', 'Plain git; Feega never commits'],
        ['Local or cloud', 'Cloud editor and hosting', 'Local terminal or editor', 'Local, no account'],
        ['Agent access', `External Agents through MCP or a local CLI (${cite(FRAMER_DEVELOPERS)})`, 'Reads and writes your files', 'Shows the selected element’s source'],
        ['Who it fits', 'Designers who publish themselves', 'Developers building pages', 'Developers adjusting pages by eye']
      ],
      callout: { tone: CalloutTone.Note, title: 'Dated figures', text: 'Plans and credits are as listed on Framer’s pricing page on 22 November 2026. Add-ons include localization at $20 a locale.' }
    }
  ],
  sections: [
    {
      heading: 'What Framer’s agent story means for your repo',
      html: `<p>${cite(FRAMER_AI)} says Framer MCP connects tools like Claude, Codex and Cursor to your projects, and describes a local CLI setup as an alternative. ${cite(FRAMER_DEVELOPERS)} lists the same three as External Agents, next to Code Components, which are custom React components with visual controls.</p><p>That is a real developer path inside Framer. It does not move the page out of Framer. If your landing page shares tokens and components with your app, you either copy them across by hand or you keep the page in the repo and edit it there. The <a href="/alternatives/framer-alternative-for-claude-code">Claude Code</a>, <a href="/alternatives/framer-alternative-for-codex">Codex</a> and <a href="/alternatives/framer-alternative-for-cursor">Cursor</a> pages cover each agent.</p>`,
      image: PROPERTIES_CROP,
      callout: { tone: CalloutTone.Tip, title: 'Tip', text: 'List which values your app and your Framer page both define. Those are the ones that drift.' }
    },
    {
      heading: 'Hosting, domains and the proxy option',
      html: `<p>${cite(FRAMER_PUBLISHING)} says you publish to a Framer subdomain or a custom domain, and that you can self-host through a reverse proxy to control headers, authentication and delivery, with Vercel, Netlify, NGINX, Cloudflare and AWS named. The page does not mention exporting your site or files.</p><p>${cite(FRAMER_PRICING)} lists 1 GB of bandwidth on Free, 50 GB on Basic and 100 GB on Pro, with a custom domain from Basic. In a repo, hosting is yours. The ${cite(FEEGA_AGENTS)} show how your agent and Feega share the files, and the <a href="/pricing">Feega pricing page</a> shows what Feega costs.</p>`,
      image: CHANGES_SHOT,
      cta: DOWNLOAD_CTA
    },
    {
      heading: 'Where a repo is the wrong home for the page',
      html: `<p>If the people changing the page never open a repo, Framer is the better home. Feega has no CMS, no publishing and no hosting, and it only edits pages that already exist in code. For pages that do live in code, <a href="${PROPERTIES_DOCS}" rel="noopener">Properties</a> and <a href="${CHANGES_DOCS}" rel="noopener">Changes</a> give you a visual pass that ends as a diff.</p><p>The <a href="/alternatives/lovable">Lovable page</a> compares a prompt-to-app builder, and the <a href="/alternatives">alternatives index</a> has the rest. The <a href="${QUICK_START_DOCS}" rel="noopener">quick start</a> takes a few minutes. Every install route is on the <a href="/download">download page</a>.</p>`,
      callout: { tone: CalloutTone.Warning, title: 'Warning', text: 'Do not plan a migration around an export button. We did not find one on the pages we read, so ask Framer first.' },
      cta: DOCS_CTA
    }
  ],
  sources: [FRAMER_PRICING, FRAMER_DEVELOPERS, FRAMER_AI, FRAMER_PUBLISHING, FEEGA_AGENTS]
};
