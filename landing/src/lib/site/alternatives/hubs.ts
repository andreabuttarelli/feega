import { ArticleKind, type Article, type Section } from './alternative';

export const HUB_CHECKED = '2026-11-22';

const AGENT_DOCS = 'https://docs.feega.app/more/ai-agents/';

const otherAgents = (subject: string): Section => ({
  heading: 'Other coding agents',
  html: `<p>Feega’s docs list Claude Code, Cursor, Copilot, Cline, Codex and Gemini CLI as agents that read the editor selection, so they see the element you picked. The skill install is documented for Claude Code, Cursor and Codex, and those three have their own pages above.</p>
<p>xAI’s Grok Build is a terminal coding agent, per <a href="https://docs.x.ai/build/overview" rel="noopener">its documentation</a>. It is not on Feega’s tested list. Feega writes plain files, so Grok Build, or any agent that edits your folder, sees your changes through the files and through git. The selection sync and the skill are untested there, so this page does not promise them. The pattern stays the same across ${subject}: you design, the agent codes, and both edit the same repo. The <a href="${AGENT_DOCS}" rel="noopener">agents page in the docs</a> is the reference.</p>`
});

export const LOVABLE_SECTIONS: readonly Section[] = [
  {
    heading: 'Using your coding agent with Feega instead',
    html: `<p>If you already write code with an agent, the question is where the agent works and where the visual edits go. Pick the page for yours:</p>
<ul>
<li><a href="/alternatives/lovable-alternative-for-claude-code">Lovable alternative for Claude Code users</a>, with the Feega skill and the plugin install.</li>
<li><a href="/alternatives/lovable-alternative-for-codex">Lovable alternative for OpenAI Codex</a>, for the CLI, the IDE extension and the desktop app.</li>
<li><a href="/alternatives/lovable-alternative-for-cursor">Lovable alternative for Cursor users</a>, where Feega runs inside the same window as the agent.</li>
</ul>
<p>Each page shows a real diff and the setup for that agent. The reasons to leave Lovable are the same on all three.</p>`
  },
  {
    heading: 'Where Lovable is the better choice',
    html: `<p>Lovable gives you a running, hosted full-stack app within minutes of writing a prompt, with nothing to install. Its GitHub sync works in both directions once the repository exists: per its docs, changes made in Lovable sync to GitHub, and commits pushed to the active branch sync back. It also says you can clone the repository and continue in your own IDE.</p>
<p>That makes it a fair way to start an app and hand it over later. It stops being the right tool when the repo came first, since Lovable only syncs one branch at a time and its commits come from <code>lovable-dev[bot]</code>, co-attributed to the member who triggered them.</p>`
  },
  otherAgents('Lovable')
];

export const FRAMER_ARTICLE: Article = {
  kind: ArticleKind.Single,
  title: 'Framer alternatives for sites built in code | Feega',
  description: 'Framer designs and hosts sites on its own canvas. If your landing page lives in a repo your agent edits, here is what changes the code instead.',
  heading: 'Framer alternatives for sites built in code',
  hook: 'Keep Framer for designer-owned sites. Edit the page your repo already ships.',
  lead: 'Keep Framer if designers own your marketing site and nobody needs it in git. It is a polished canvas that publishes and hosts for you. This page is for people whose landing page already lives in a repo, often written with a coding agent.',
  pickThem: {
    name: 'Framer',
    points: ['Designers own the site and publish it themselves.', 'You want hosting, a CMS and analytics in one place.', 'The page needs no shared code with your app.']
  },
  pickFeega: ['The landing page lives in your repo next to the app.', 'A coding agent writes it, and you want to adjust it by hand.', 'You want every change as a diff, with no AI and no credits.'],
  sections: [
    {
      heading: 'Where Framer is the better choice',
      html: `<p>Framer is built for people who design in a canvas and publish without a developer. Its pricing page lists a global hosting network and a CMS on the paid plans, staging, branching with previews and redirects on Pro, and A/B testing as an add-on. A repo gives you none of that out of the box.</p>
<p>It also has a real developer story. Code Components are custom React components that render inside a Framer project, and Code Overrides modify layer properties. If your team wants a visual tool with some code in it, that is a good answer. If your team wants the code to be the source, it is the opposite arrangement.</p>`
    },
    {
      heading: 'Using your coding agent with Feega instead',
      html: `<p>Framer’s developer page lists External Agents: Claude Code, Codex or Cursor connected to a Framer project, through MCP or a local CLI setup. The agent edits Framer. With Feega the agent edits your repo, and you adjust the result by hand. Pick the page for your agent:</p>
<ul>
<li><a href="/alternatives/framer-alternative-for-claude-code">Framer alternative for Claude Code users</a>, with the Feega skill and the plugin install.</li>
<li><a href="/alternatives/framer-alternative-for-codex">Framer alternative for OpenAI Codex</a>, for the CLI, the IDE extension and the desktop app.</li>
<li><a href="/alternatives/framer-alternative-for-cursor">Framer alternative for Cursor users</a>, where Feega runs inside the same window as the agent.</li>
</ul>
<p>If you only want a plain comparison with another tool that edits code, read the <a href="/alternatives/lovable">Lovable page</a> for the prompt-to-app route.</p>`
    },
    {
      heading: 'What Feega edits and what it does not',
      html: `<p>Feega works on SvelteKit, React with Vite, Next.js and Vue projects that run from your own folder. It writes Tailwind classes, or rules in your CSS, at the line of the element you clicked. Class names built by an expression and text that comes from data are refused with a message that points at the line.</p>
<p>It has no CMS, no hosting and no publishing. If your landing page needs editors who never open a repo, a CMS in Framer is a better fit. Read <a href="/alternatives/ai-site-builder-or-your-repo">AI site builder or your repo</a> for how to weigh that.</p>`
    },
    otherAgents('Framer')
  ],
  mistakes: [
    { q: 'Moving a site that designers still edit.', a: 'If they publish from Framer every week, a repo takes that away from them. Move the page only when the repo is where the changes already happen.' },
    { q: 'Expecting an export button.', a: 'The pages we read do not mention exporting the site as code. Check with Framer before you plan a migration.' },
    { q: 'Counting only the plan price.', a: 'Pages, CMS collections and bandwidth have caps with paid steps above them, and agents spend AI credits.' }
  ],
  questions: [
    { q: 'Is Framer free?', a: 'There is a free plan at $0. A custom domain starts at Basic, $10 a month. Pro is $30 a month.' },
    { q: 'Does Framer host the site?', a: 'Yes. It publishes to its own hosting, and it documents a reverse-proxy setup for putting the site behind another host.' },
    { q: 'Is Feega a Framer replacement?', a: 'Only for pages that live in code. It has no CMS or hosting.' }
  ],
  sources: [
    { label: 'Framer pricing', href: 'https://www.framer.com/pricing' },
    { label: 'Framer developers', href: 'https://www.framer.com/developers/' },
    { label: 'Framer help: AI and agents', href: 'https://www.framer.com/help/ai/' },
    { label: 'Framer help: publishing and hosting', href: 'https://www.framer.com/help/publishing/' },
    { label: 'Feega docs: use Feega with AI agents', href: AGENT_DOCS }
  ],
  checked: HUB_CHECKED
};
