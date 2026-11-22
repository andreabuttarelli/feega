import { ArticleKind, DiffSign, VisualKind, diff, table, type Article, type Highlight, type Question, type Rich, type Section, type Source, type Step, type Visual } from './alternative';
import { HUB_CHECKED } from './hubs';
import { EDITOR_VISUAL } from './rich/shared';

const AGENT_DOCS = 'https://docs.feega.app/more/ai-agents/';

const FEEGA_DOCS_SOURCE: Source = { label: 'Feega docs: use Feega with AI agents', href: AGENT_DOCS };

type Subject = {
  readonly slug: string;
  readonly name: string;
  readonly titleName: string;
  readonly snapshotRows: readonly (readonly string[])[];
  readonly theirColumn: string;
  readonly workflow: Highlight;
  readonly costParagraphs: readonly string[];
  readonly winsHeading: string;
  readonly winsHtml: string;
  readonly pickThem: readonly string[];
  readonly mistakes: readonly Question[];
  readonly questions: readonly Question[];
  readonly sources: readonly Source[];
};

type Agent = {
  readonly slug: string;
  readonly name: string;
  readonly titleName: string;
  readonly setupHeading: string;
  readonly setupHtml: string;
  readonly handoff: { readonly heading: string; readonly paragraphs: readonly string[] };
  readonly askHeading: string;
  readonly askHtml: string;
  readonly steps: readonly Step[];
  readonly mistakes: readonly Question[];
  readonly questions: readonly Question[];
  readonly sources: readonly Source[];
  readonly agentRow: string;
};

type Pair = {
  readonly description: string;
  readonly hook: string;
  readonly lead: string;
  readonly verdict: string;
  readonly pickFeega: readonly string[];
  readonly bridge: string;
  readonly together: Section;
  readonly closing: string;
  readonly file: string;
  readonly lines: Visual;
  readonly caption: string;
};

const LOVABLE: Subject = {
  slug: 'lovable',
  name: 'Lovable',
  titleName: 'Lovable',
  theirColumn: 'Lovable',
  snapshotRows: [
    ['Starts from', 'A prompt, or a ZIP upload', 'Your existing repo'],
    ['GitHub', 'Sync creates a new repository', 'Edits your folder in place'],
    ['Commit author', 'lovable-dev[bot], co-attributed to the member who triggered it', 'You'],
    ['Branches', 'One synced branch at a time', 'Whatever branch you are on'],
    ['Price', 'Free has 5 build credits a day, Pro is $25 a month', 'Free, Apache-2.0']
  ],
  workflow: {
    heading: 'Lovable wants the app inside Lovable',
    paragraphs: [
      'According to Lovable’s GitHub docs, sync always creates a new repository. To start from code you already have, you download a ZIP and upload it. After that, changes made in Lovable go to GitHub and commits pushed to the active branch come back, one branch at a time.',
      'That is a reasonable arrangement for an app that began in Lovable. When the repo came first, it gives you a second copy of the product and a bot in the history of the one you have.'
    ],
    visual: {
      kind: VisualKind.Flow,
      them: { title: 'Bring your app to the tool', steps: ['Zip your project', 'Upload it', 'Prompt the change', 'Sync a new repository'] },
      us: { title: 'Bring the tool to your app', steps: ['Open your repo', 'Click the element', 'Set the value', 'Commit yourself'] }
    },
    caption: 'Neutral illustration of the two paths.'
  },
  costParagraphs: [
    'Lovable’s free plan has 5 build credits a day and Pro is $25 a month, per its plans page when we checked on 22 November 2026. Credits run per build, so count how many your edits actually take.',
    'Feega is free and open source under Apache-2.0, with no credits and no account. You still pay for your own agent and your own hosting, as you do now.'
  ],
  winsHeading: 'Where Lovable is still the better choice',
  winsHtml:
    '<p>Lovable turns a prompt into a hosted full-stack app, with nothing to install. If there is no code yet, or you want a working prototype to show someone this afternoon, it is hard to beat. Its GitHub sync also lets you clone the repository and keep working in your own tools.</p><p>Feega does none of that. It has no prompt-to-app builder and no hosting, and it only edits pages that already exist in your repo.</p>',
  pickThem: ['You start from nothing and want a hosted app from a prompt.', 'You want chat to be the only interface.', 'You want hosting and the database included.'],
  mistakes: [
    { q: 'Uploading a finished app to change one page.', a: 'You end up with two copies to keep in step, and only one of them has your history.' },
    { q: 'Judging by one prompt.', a: 'Try both on your own repo with a change you made last week. Compare how long it took and what the diff looked like.' }
  ],
  questions: [
    { q: 'What does Lovable cost?', a: 'Free has 5 build credits a day. Pro is $25 a month, per its plans page.' },
    { q: 'Can Lovable push to my existing GitHub repo?', a: 'Not directly. Its sync always creates a new repository, and you upload a ZIP to start from yours.' }
  ],
  sources: [
    { label: 'Lovable GitHub integration', href: 'https://docs.lovable.dev/integrations/github' },
    { label: 'Lovable plans', href: 'https://docs.lovable.dev/introduction/subscription-plans' }
  ]
};

const FRAMER: Subject = {
  slug: 'framer',
  name: 'Framer',
  titleName: 'Framer',
  theirColumn: 'Framer',
  snapshotRows: [
    ['Where the page lives', 'In a Framer project, hosted by Framer', 'In your repo, hosted wherever you host'],
    ['Source files', 'No code export or git sync on the pages we read', 'Your own files, edited in place'],
    ['Agents', 'External Agents connect through MCP or a local CLI setup', 'They read the files Feega writes'],
    ['Price', 'Free at $0, Basic $10 a month, Pro $30 a month', 'Free, Apache-2.0']
  ],
  workflow: {
    heading: 'Framer wants the page inside Framer',
    paragraphs: [
      'On the pricing and help pages we read, Framer publishes the site to its own hosting. None of those pages mentions exporting the site as code or syncing it with git, so the Framer project stays the source of truth for the page.',
      'That works until the landing page belongs to your product. Tokens, copy and components that also live in your app have to be copied across by hand each time one of them changes.'
    ],
    visual: {
      kind: VisualKind.Flow,
      them: { title: 'Page in a canvas', steps: ['Design in Framer', 'Publish to Framer hosting', 'Copy tokens by hand', 'Repeat for each change'] },
      us: { title: 'Page in your repo', steps: ['Open the repo', 'Click the element', 'Set the value', 'Review the diff'] }
    },
    caption: 'Neutral illustration of the two paths.'
  },
  costParagraphs: [
    'Framer’s free plan is $0 with 500 AI credits a month and a Framer domain. A custom domain needs Basic at $10 a month, and Pro is $30 a month, per its pricing page on 22 November 2026. Agents and other AI features spend credits.',
    'Feega is free and open source under Apache-2.0, with no credits and no account. Hosting and your agent’s plan stay what they are today.'
  ],
  winsHeading: 'Where Framer is still the better choice',
  winsHtml:
    '<p>Framer is built for people who design in a canvas and publish without a developer. Its paid plans add a CMS, staging, branching with previews and redirects, so designers can ship on their own.</p><p>Feega has no CMS, no publishing and no hosting. If the people changing the page never open a repo, Framer fits them better.</p>',
  pickThem: ['Designers publish the site themselves.', 'You want hosting and a CMS in one place.', 'The page shares no code with your app.'],
  mistakes: [
    { q: 'Moving a site that designers still publish weekly.', a: 'A repo takes publishing away from them. Move the page only where changes already happen in code.' },
    { q: 'Expecting an export button.', a: 'The pages we read do not mention exporting the site as code. Ask Framer before you plan a migration.' }
  ],
  questions: [
    { q: 'What does Framer cost?', a: 'The free plan is $0. Basic is $10 a month and Pro is $30 a month, with AI credits and caps on pages and bandwidth.' },
    { q: 'Can Framer export my site as code?', a: 'The pricing and help pages we read do not say so.' }
  ],
  sources: [
    { label: 'Framer pricing', href: 'https://www.framer.com/pricing' },
    { label: 'Framer developers', href: 'https://www.framer.com/developers/' },
    { label: 'Framer help: AI and agents', href: 'https://www.framer.com/help/ai/' }
  ]
};

const CLAUDE_CODE: Agent = {
  slug: 'claude-code',
  name: 'Claude Code',
  titleName: 'Claude Code',
  agentRow: 'Reads the project, writes the code, loads the Feega skill',
  setupHeading: 'Set up Claude Code once',
  setupHtml:
    '<p>Feega ships a skill for Claude Code. In Claude Code, install it as a plugin with <code>/plugin install feega --marketplace andreabuttarelli/feega</code>, or run <code>npx skills add andreabuttarelli/feega</code> in the project.</p><p>Per Anthropic’s docs, a skill is a <code>SKILL.md</code> file whose instructions load only when they are used, and a project skill lives in <code>.claude/skills</code> and can be committed. Facts that never change belong in <code>CLAUDE.md</code>, which Claude reads at the start of every session. The docs suggest keeping procedures in skills and facts in <code>CLAUDE.md</code>, so a good split is the skill for how, and one line in <code>CLAUDE.md</code> for the rule that class names stay literal.</p><p>The skill teaches Claude Code to add <code>feega-source-map</code> to a Next.js or Vite config, to start the editor with <code>npx feega</code>, and to write markup Feega can edit back.</p>',
  handoff: {
    heading: 'Claude Code codes, you design, one set of files',
    paragraphs: [
      'Feega has no AI of its own. It sits next to Claude Code: Claude Code writes the component, you open the running page, click the element and set the padding or the type by hand. Both of you write to the same file, and git shows both as ordinary diffs.',
      'Feega also reveals the selected element’s source in a text editor beside it, so Claude Code sees the line you picked. Right-click the element and choose Copy for agent to hand it the file, line, selector and preview width in one paste.'
    ]
  },
  askHeading: 'What to ask Claude Code, and what to do by hand',
  askHtml:
    '<p>Ask Claude Code for the structural work: a new section, a form, a data loop, a refactor. Ask it to write the markup so Feega can edit it back. That means literal Tailwind classes, visible words in the markup and icons from the supported libraries.</p><p>Do the small visual passes yourself in Feega. Spacing, radius, colour and type size are quick to set by eye and slow to describe, and a hand edit costs no tokens. When you are done, tell Claude Code to read the diff, so that its next change starts from the page you shaped.</p>',
  steps: [
    { title: 'Install the skill', text: 'Run /plugin install feega --marketplace andreabuttarelli/feega in Claude Code, or npx skills add andreabuttarelli/feega in the project.' },
    { title: 'Ask for setup', text: 'Say “set this project up for Feega”. Claude Code adds the source map where the framework needs it.' },
    { title: 'Open the page', text: 'Say “start Feega”, or run npx feega in the app folder. The running page opens next to your layers.' },
    { title: 'Click and set', text: 'Pick the element and change its values in the Properties bar. Copy for agent hands the element to Claude Code when you want it to take over.' },
    { title: 'Review together', text: 'Read the diff in Changes, then let Claude Code carry on from the new files. Commit with your own identity.' }
  ],
  mistakes: [
    { q: 'Letting the agent write class names through cn() on every element.', a: 'Feega refuses expressions it cannot trace to one line. Keep literal strings on the elements people tweak.' },
    { q: 'Describing a two-second drag to the agent.', a: 'Spend the tokens on code, and set the spacing by hand.' }
  ],
  questions: [
    { q: 'How do I install the Feega skill in Claude Code?', a: 'Run /plugin install feega --marketplace andreabuttarelli/feega, or npx skills add andreabuttarelli/feega in the project.' },
    { q: 'Does Claude Code see what I select in Feega?', a: 'Feega reveals the selected element’s source beside it, and Claude Code is one of the agents that read the editor selection per the Feega docs.' },
    { q: 'Does Feega use Claude Code’s tokens?', a: 'No. Feega has no model behind it and sends nothing anywhere.' }
  ],
  sources: [
    { label: 'Claude Code: skills', href: 'https://code.claude.com/docs/en/skills' },
    { label: 'Claude Code: memory and CLAUDE.md', href: 'https://code.claude.com/docs/en/memory' }
  ]
};

const CODEX: Agent = {
  slug: 'codex',
  name: 'OpenAI Codex',
  titleName: 'OpenAI Codex',
  agentRow: 'Runs locally in a terminal, an IDE or a desktop app',
  setupHeading: 'Set up Codex once',
  setupHtml:
    '<p>OpenAI describes Codex CLI as a coding agent that runs locally on your computer. Its repository lists the terminal CLI, an IDE extension, a desktop app and Codex Web at chatgpt.com/codex. Feega edits files on your machine and needs your dev server running, so pair it with a local surface: the CLI, the IDE extension or the desktop app.</p><p>Feega’s docs name Codex among the agents the skill is meant for. Install it with <code>npx skills add andreabuttarelli/feega</code> in the project. The skill teaches the agent to add <code>feega-source-map</code> to a Next.js or Vite config, to start the editor and to write markup Feega can edit back.</p>',
  handoff: {
    heading: 'Codex works in a terminal, Feega works on the page',
    paragraphs: [
      'A terminal agent never sees your browser. Feega closes that gap without a model: you click the element on the running page, and Feega shows its source line in an editor beside it, so Codex, which the Feega docs list among the agents that read the editor selection, can see what you picked.',
      'For a plain terminal session, use Copy for agent and paste the file, line, selector and preview width into the prompt. Codex then edits the same line Feega writes to.'
    ]
  },
  askHeading: 'What to ask Codex, and what to do by hand',
  askHtml:
    '<p>Give Codex the jobs that suit a terminal: add a route, wire a form, rename a prop across the project, fix a failing build. Ask it to keep class names literal and copy in the markup, so the result stays editable.</p><p>Keep the visual passes for Feega. Moving a card by a few pixels or choosing a colour by eye takes seconds on the page and a full prompt in the terminal. Between rounds, run <code>git diff</code> so Codex starts from what is on disk, not from its memory of the last turn.</p>',
  steps: [
    { title: 'Install the skill', text: 'Run npx skills add andreabuttarelli/feega in the project folder.' },
    { title: 'Ask for setup', text: 'Tell Codex to set the project up for Feega. It adds the source map where the framework needs it.' },
    { title: 'Start the editor', text: 'Run npx feega in a second terminal, or open the folder in the VS Code extension. Keep the dev server running.' },
    { title: 'Click and set', text: 'Pick the element and change its values. Copy for agent puts the element’s location on your clipboard for the Codex prompt.' },
    { title: 'Read the diff', text: 'Run git diff or open Changes in Feega, then continue with Codex. Commit under your own name.' }
  ],
  mistakes: [
    { q: 'Using Codex Web with a local editor.', a: 'Feega edits files on your machine and needs your dev server. Use the CLI, the IDE extension or the desktop app.' },
    { q: 'Skipping the diff between turns.', a: 'The agent should read the files you changed. Run git diff before the next prompt.' }
  ],
  questions: [
    { q: 'How do I use Feega with Codex?', a: 'Install the skill with npx skills add andreabuttarelli/feega, run npx feega, and let Codex edit the same files.' },
    { q: 'Does Codex see what I select in Feega?', a: 'Feega reveals the selected element’s source beside it, and Codex is one of the agents that read the editor selection per the Feega docs.' },
    { q: 'Does Feega need an OpenAI account?', a: 'No. Feega has no account and no model.' }
  ],
  sources: [
    { label: 'OpenAI Codex on GitHub', href: 'https://github.com/openai/codex' }
  ]
};

const CURSOR: Agent = {
  slug: 'cursor',
  name: 'Cursor',
  titleName: 'Cursor users',
  agentRow: 'Agent in the sidepane, with Feega in the same window',
  setupHeading: 'Set up Cursor once',
  setupHtml:
    '<p>Feega installs as an extension in Cursor, so the visual editor and the agent share a window. Run the command <strong>Feega: Open from current workspace</strong> and the running app opens next to your code. Cursor’s agent opens in the sidepane with Cmd+I, per its docs.</p><p>Cursor keeps agent instructions as project rules in <code>.cursor/rules</code>, written as <code>.mdc</code> files, and also reads an <code>AGENTS.md</code> file in the project root. Add a short rule saying to keep Tailwind classes and visible text literal on the elements people tweak, and the agent will write markup Feega can edit. To install the Feega skill as well, run <code>npx skills add andreabuttarelli/feega</code>.</p>',
  handoff: {
    heading: 'One window for the agent and the canvas',
    paragraphs: [
      'Cursor has its own visual route. Design Mode, per its docs, needs Cursor 3.24.18 or later and a running dev server, and it hands your annotation to the agent. Feega takes the other approach on the same page: you set the value yourself, and the file changes without a model in the loop.',
      'Selecting an element in Feega reveals its source line in the editor beside it, and Cursor is one of the agents that read the editor selection per the Feega docs. Selecting a line in the editor selects the element on the page.'
    ]
  },
  askHeading: 'What to ask the Cursor agent, and what to do by hand',
  askHtml:
    '<p>Use the agent for what spans files: a new page, a state change, a form with validation. Use Design Mode when you want the agent to interpret a change you can only describe. Use Feega when you know the value you want.</p><p>The two do not conflict. They write to the same files, and Cursor’s checkpoints and your git history both see the result. After a hand edit, mention it in the next prompt, or let the agent read the file, so it does not undo the change.</p>',
  steps: [
    { title: 'Install in Cursor', text: 'Add the Feega extension to Cursor, or run npx feega in the project folder.' },
    { title: 'Add a rule', text: 'Write a short project rule or AGENTS.md note: literal class names and visible text on elements people will tweak.' },
    { title: 'Open the app', text: 'Run Feega: Open from current workspace. Feega starts your dev server and shows the page beside your code.' },
    { title: 'Click and set', text: 'Pick the element and change its values in the Properties bar while the agent pane stays open.' },
    { title: 'Review in Changes', text: 'Read the diff, keep or undo each edit, then prompt the agent to continue. Commit as usual.' }
  ],
  mistakes: [
    { q: 'Treating Design Mode and Feega as rivals.', a: 'They write to the same files. Use the agent for described changes and Feega for values you know.' },
    { q: 'Forgetting to tell the agent about a hand edit.', a: 'A later prompt can restate old values. Let the agent read the file first.' }
  ],
  questions: [
    { q: 'Does Feega run inside Cursor?', a: 'Yes. It installs in VS Code, Cursor, Windsurf and VSCodium, and also runs in the browser with npx feega.' },
    { q: 'What is the difference between Cursor Design Mode and Feega?', a: 'Design Mode passes your annotation to the agent. Feega writes the value you set by hand, with no model.' },
    { q: 'Does Cursor see my selection in Feega?', a: 'Feega reveals the element’s source beside it, and Cursor is one of the agents that read the editor selection per the Feega docs.' }
  ],
  sources: [
    { label: 'Cursor: Agent overview', href: 'https://cursor.com/docs/agent/overview' },
    { label: 'Cursor: Rules', href: 'https://cursor.com/docs/context/rules' },
    { label: 'Cursor: Design Mode', href: 'https://cursor.com/docs/agent/design-mode' }
  ]
};

const PAIRS: Readonly<Record<string, Pair>> = {
  'lovable-claude-code': {
    description: 'Lovable builds hosted apps from prompts. If you code with Claude Code in your own repo, here is a free, local editor that writes visual edits to source.',
    hook: 'Claude Code writes it. You shape it. Your repo stays the only copy.',
    lead: 'Keep Lovable if you have no code yet. If you already work with Claude Code in a repo of your own, Lovable adds a second home for the app, and Feega adds none: Claude Code writes the page, and you adjust it by hand in the same files.',
    verdict:
      'Claude Code users already have the thing Lovable sells, an agent that turns words into code, and they have it in their own repo with their own commits. What they lack is a fast way to nudge a layout by eye. Feega covers that and nothing else: it is free, local and open source, with no model behind it.',
    pickFeega: ['You already build with Claude Code in your own repo.', 'You want the visual pass to cost no tokens.', 'You want one codebase and your name on every commit.'],
    bridge: 'Claude Code has no canvas and Feega has no brain, so they cover each other.',
    together: { heading: 'If your app began in Lovable', html: '<p>If the project began in Lovable, you do not have to start over. Lovable’s docs say you can clone the synced repository and continue in your own IDE. Clone it, open the folder in your terminal, start Claude Code and run <code>npx feega</code> beside it.</p><p>Two things to know. Lovable only syncs one branch at a time, so to see a change back in Lovable, push to the branch it watches. And the earlier commits stay as they are, authored by <code>lovable-dev[bot]</code>. From here on, Claude Code’s changes and your Feega edits are written to the folder, and you commit them yourself.</p><p>Feega never talks to Lovable, so a hand edit spends no build credits.</p>' },
    closing: 'Keep Lovable for a new app. Keep Claude Code and your repo for the one you have.',
    file: 'src/routes/+page.svelte',
    lines: {
      kind: VisualKind.Diff,
      file: 'src/routes/+page.svelte',
      lines: diff(
        [DiffSign.Keep, '.hero h1 {'],
        [DiffSign.Remove, '  font-size: 2.5rem;'],
        [DiffSign.Add, '  font-size: 3.25rem;'],
        [DiffSign.Keep, '  letter-spacing: -0.04em;'],
        [DiffSign.Keep, '}']
      )
    },
    caption: 'A type size set by hand in Feega, after Claude Code wrote the hero. The rule lives in the component’s own style block.'
  },
  'lovable-codex': {
    description: 'Lovable builds hosted apps from prompts. If you code with OpenAI Codex in your own repo, here is a free, local editor that writes visual edits to source.',
    hook: 'Codex runs the terminal. Feega handles the page. One repo.',
    lead: 'Keep Lovable if you have no code yet. If Codex already writes code in your repo, Lovable would be a second place to keep the app. Feega adds a visual editor to the repo you have, and Codex keeps working in the same files.',
    verdict:
      'Codex lives in a terminal, an IDE or a desktop app on your machine, and it works on your folder. Lovable moves the app to a hosted project and syncs it to a new repository. Feega stays on your side: it edits the running page from your folder, writes the change to source, and leaves the rest to Codex.',
    pickFeega: ['You already run Codex on your own repo.', 'You want to set a layout by eye and skip describing it in a prompt.', 'You want edits as diffs under your own name.'],
    bridge: 'A terminal agent cannot see your browser, and Feega shows the browser without a model.',
    together: { heading: 'Keeping Codex on a Lovable repo', html: '<p>Codex works on a folder, so a Lovable project needs to be a folder first. Per Lovable’s GitHub docs you can clone the synced repository and work in your own IDE. Clone it, run Codex in it, and keep <code>npx feega</code> in a second terminal.</p><p>A useful first prompt is to ask Codex to read the recent commits. Most of them will be authored by <code>lovable-dev[bot]</code>, and a summary of what the bot changed is a fast way to learn the structure Lovable generated.</p><p>After that, divide the work as usual. Codex handles routes, forms and renames. You handle spacing and colour on the running page in Feega. Both end up in <code>git diff</code>, and the branch Lovable watches only matters if you want the changes to flow back.</p>' },
    closing: 'Keep Lovable for a new app. Keep Codex and your repo for the one you have.',
    file: 'app/components/PricingCard.tsx',
    lines: {
      kind: VisualKind.Diff,
      file: 'app/components/PricingCard.tsx',
      lines: diff(
        [DiffSign.Keep, '<div'],
        [DiffSign.Remove, '  className="rounded-md p-4 shadow-sm"'],
        [DiffSign.Add, '  className="rounded-xl p-6 shadow-md"'],
        [DiffSign.Keep, '>']
      )
    },
    caption: 'A card restyled by hand in Feega after Codex built it. The change is a class edit in the component.'
  },
  'lovable-cursor': {
    description: 'Lovable builds hosted apps from prompts. If you build in Cursor, here is a free, open-source editor that runs inside it and writes edits to your source.',
    hook: 'Cursor has the agent. Feega adds the canvas in the same window.',
    lead: 'Keep Lovable if you have no code yet. If you already build in Cursor, you do not need to move the app to get a visual editor. Feega installs as an extension in Cursor and writes what you change to your own files.',
    verdict:
      'Cursor users have the agent and the repo in one window. Lovable would add a hosted project and a bot-authored sync. Feega adds the missing piece inside the window you already use: click the running page, change the value, and the file changes under your own name.',
    pickFeega: ['You already work in Cursor on your own repo.', 'You want a Properties bar next to the agent pane.', 'You want hand edits with no tokens and no model.'],
    bridge: 'Cursor’s agent and Feega share one window and one set of files.',
    together: { heading: 'Opening a Lovable repo in Cursor', html: '<p>A project that started in Lovable opens in Cursor like any repo. Lovable’s docs describe cloning the synced repository and continuing in your preferred IDE, and Cursor is one. Open the clone, install the Feega extension and run <strong>Feega: Open from current workspace</strong>.</p><p>You will see code that Lovable generated, so give the agent a short rule about literal class names before it writes more. Lovable only syncs one branch, so if you want a change to show up in Lovable again, commit to that branch.</p><p>A hand edit in the Feega panel is a file change in the clone. It does not touch Lovable and it uses no build credits.</p>' },
    closing: 'Keep Lovable for a new app. Keep Cursor and your repo for the one you have.',
    file: 'src/components/Hero.vue',
    lines: {
      kind: VisualKind.Diff,
      file: 'src/components/Hero.vue',
      lines: diff(
        [DiffSign.Keep, '<button'],
        [DiffSign.Remove, '  class="px-4 py-2 text-sm"'],
        [DiffSign.Add, '  class="px-6 py-3 text-base"'],
        [DiffSign.Keep, '>Start</button>']
      )
    },
    caption: 'A button resized in Feega while the Cursor agent pane stayed open. One class change in the component.'
  },
  'framer-claude-code': {
    description: 'Framer designs and hosts sites on its own canvas. If Claude Code writes your landing page in a repo, here is a free local editor that edits that code.',
    hook: 'Claude Code edits your repo. So does Feega. Framer is somewhere else.',
    lead: 'Keep Framer if designers own the site. If your landing page lives in a repo and Claude Code writes it, Framer would mean a second home for the page. Feega edits the repo directly, and Claude Code keeps working in it.',
    verdict:
      'Framer lists Claude Code as an external agent that can update a Framer project through MCP or a local CLI. That puts the page in Framer. If the page is already code, the shorter path is to keep it there: Claude Code writes the markup, and you set spacing and type by hand in Feega, in the same files.',
    pickFeega: ['Claude Code already writes your landing page in a repo.', 'You want the page to share components and tokens with the app.', 'You want every change as a diff, with no credits.'],
    bridge: 'Both tools take Claude Code as a partner, but only one leaves the page in your repo.',
    together: { heading: 'Moving a Framer landing page into a repo', html: '<p>None of the Framer pages we read describe a code export, so plan for a rebuild. Keep the Framer site live while you work. In your repo, ask Claude Code to build the page from the design, one section at a time, using your own components and tokens.</p><p>Once a section exists, open it in Feega and fine-tune spacing, type and colour by eye against the live Framer page. That is the part of a rebuild that eats the most prompts, and the part Feega does without a model.</p><p>If you would rather keep the page in Framer and still use Claude Code, Framer lists that as External Agents, connected through MCP or a local CLI setup. That is a different arrangement, and the page stays in Framer.</p>' },
    closing: 'Keep Framer for a site designers own. Keep Claude Code and the repo for a page your product shares.',
    file: 'src/lib/Hero.svelte',
    lines: {
      kind: VisualKind.Diff,
      file: 'src/lib/Hero.svelte',
      lines: diff(
        [DiffSign.Keep, '.cta {'],
        [DiffSign.Remove, '  padding: 12px 20px;'],
        [DiffSign.Add, '  padding: 14px 24px;'],
        [DiffSign.Keep, '  border-radius: 6px;'],
        [DiffSign.Keep, '}']
      )
    },
    caption: 'A call-to-action resized by hand after Claude Code wrote the landing page. The change is a CSS rule in the component.'
  },
  'framer-codex': {
    description: 'Framer designs and hosts sites on its own canvas. If OpenAI Codex writes your landing page in a repo, here is a free local editor that edits that code.',
    hook: 'Codex writes the repo. Feega sets the values. Framer stays out of it.',
    lead: 'Keep Framer if designers own the site. If Codex already writes your landing page in a repo, you can keep the page there. Feega edits the repo by hand, and Codex keeps working in the same files.',
    verdict:
      'Framer’s developer page lists Codex as an external agent for a Framer project. That is useful when the site is a Framer site. When the site is code, the page can stay in the repo: Codex handles structure from the terminal, and Feega handles the visual pass on the running page, with no model and no credits.',
    pickFeega: ['Codex already writes your landing page in a repo.', 'You prefer to set spacing by eye instead of in a prompt.', 'You want no hosting plan or AI credits to pay for.'],
    bridge: 'Codex reads files and Framer holds a project, so only one of them needs your repo.',
    together: { heading: 'Moving a Framer page and its content into a repo', html: '<p>Framer’s CMS help lists a Markdown route: import, export and manage Markdown content. For a blog or a list of features, that is a clean way to carry the words into your repo as files that Codex can read and place.</p><p>The layout has no documented export, so rebuild it. Ask Codex to build each section from the live page, then open the running result in Feega and adjust spacing and type against Framer side by side. Keep the Framer site published until the repo version matches.</p><p>Framer also lists Codex as an external agent for a Framer project. That keeps the page in Framer, so choose it only if you want the page to stay there.</p>' },
    closing: 'Keep Framer for a site designers own. Keep Codex and the repo for a page your product shares.',
    file: 'app/page.tsx',
    lines: {
      kind: VisualKind.Diff,
      file: 'app/page.tsx',
      lines: diff(
        [DiffSign.Keep, '<section'],
        [DiffSign.Remove, '  className="py-16 text-center"'],
        [DiffSign.Add, '  className="py-24 text-center"'],
        [DiffSign.Keep, '>']
      )
    },
    caption: 'Section spacing raised by hand after Codex built the page. One class edit in the page file.'
  },
  'framer-cursor': {
    description: 'Framer designs and hosts sites on its own canvas. If you build your landing page in Cursor, here is a free editor that runs inside it and edits your code.',
    hook: 'Cursor edits the repo. Feega adds the canvas. No second home for the page.',
    lead: 'Keep Framer if designers own the site. If you build the landing page in Cursor, you can keep it in the repo and add a visual editor inside the same window. Feega installs as a Cursor extension and writes to your files.',
    verdict:
      'Framer lists Cursor as an external agent for a Framer project, which means Cursor would edit Framer. If the page is already code, Cursor and Feega can share the repo: the agent builds, and the Feega panel next to it lets you click the page and set values by hand.',
    pickFeega: ['You build the landing page in Cursor, in a repo.', 'You want a Properties bar in the same window as the agent.', 'You want edits as diffs, with no hosting plan or credits.'],
    bridge: 'Cursor is the place where code and canvas can share a window.',
    together: { heading: 'Reusing what you built in Framer', html: '<p>Framer’s Code Components are custom React components. If your team wrote some, that code is yours, and you can bring it into the repo as ordinary components. The visual layout around them has no documented export, so rebuild it in Cursor, a section at a time.</p><p>Run the app, open the Feega panel and compare it with the live Framer page while you set spacing and type. The agent pane stays open beside it for the structural work, and the hand edits land as class changes in the same files.</p><p>Framer lists Cursor as an external agent for a Framer project too. That keeps the page in Framer, which suits sites that designers still publish.</p>' },
    closing: 'Keep Framer for a site designers own. Keep Cursor and the repo for a page your product shares.',
    file: 'src/components/Navbar.vue',
    lines: {
      kind: VisualKind.Diff,
      file: 'src/components/Navbar.vue',
      lines: diff(
        [DiffSign.Keep, '<nav'],
        [DiffSign.Remove, '  class="flex gap-4 py-3"'],
        [DiffSign.Add, '  class="flex gap-6 py-4"'],
        [DiffSign.Keep, '>']
      )
    },
    caption: 'Navigation spacing changed in the Feega panel inside Cursor. One class edit in the component.'
  }
};

const title = (s: Subject, a: Agent) => `Open-source ${s.titleName} alternative for ${a.titleName} | Feega`;

const pagePath = (s: Subject, a: Agent) => `/alternatives/${s.slug}-alternative-for-${a.slug}`;

const rows = (s: Subject, a: Agent) => [...s.snapshotRows.slice(0, 2), ['Your coding agent', `${a.name} works in your repo; the tool wants its own copy`, a.agentRow], ...s.snapshotRows.slice(2)];

function related(s: Subject, a: Agent, siblings: readonly Agent[], otherSubject: Subject): Section {
  const sameSubject = siblings.map((x) => `<li><a href="${pagePath(s, x)}">${s.name} alternative for ${x.name}</a></li>`).join('');

  return {
    heading: `More on ${s.name} and your agent`,
    html: `<p>This page covers ${a.name}. The wider comparison is on <a href="/alternatives/${s.slug}">${s.name} alternatives</a>. Other agents with the same question:</p><ul>${sameSubject}<li><a href="${pagePath(otherSubject, a)}">${otherSubject.name} alternative for ${a.name}</a></li></ul><p>Feega is free. <a href="/download">Download it</a> or read the <a href="${AGENT_DOCS}" rel="noopener">agents page in the docs</a>.</p>`
  };
}

function build(s: Subject, a: Agent, otherSubject: Subject, siblings: readonly Agent[]): readonly [string, Article, Rich] {
  const pair = PAIRS[`${s.slug}-${a.slug}`];
  const slug = `${s.slug}-alternative-for-${a.slug}`;

  const handoff: Highlight = { heading: a.handoff.heading, paragraphs: a.handoff.paragraphs, visual: EDITOR_VISUAL, caption: 'The Feega editor: layers, the live page and the Properties bar.' };
  const example: Highlight = {
    heading: `A real edit, written to source`,
    paragraphs: [
      `Here is what a hand edit leaves behind in ${pair.file}. Feega writes at the line of the element you clicked, as a Tailwind class or a rule in your own CSS, and nothing else in the file moves.`,
      `${pair.bridge} The diff is the same one your agent will read on its next turn, and the same one git will show in review.`
    ],
    visual: pair.lines,
    caption: pair.caption
  };

  const rich: Rich = {
    verdict: pair.verdict,
    snapshotHeading: `${s.name}, ${a.name} and Feega at a glance`,
    snapshot: table(['', s.theirColumn, 'Feega'], rows(s, a)),
    highlights: [s.workflow, example, handoff],
    cost: { heading: 'What each one costs', paragraphs: s.costParagraphs },
    stepsHeading: `Try Feega with ${a.name} in five steps`,
    steps: a.steps,
    closing: pair.closing,
    moreQuestions: [...a.questions, { q: `Does Feega replace ${a.name}?`, a: `No. ${a.name} writes code and Feega sets visual values in the same files.` }]
  };

  const article: Article = {
    kind: ArticleKind.Agent,
    title: title(s, a),
    description: pair.description,
    heading: `The open-source, local ${s.name} alternative for ${a.titleName === 'Cursor users' ? 'Cursor users' : `${a.name} users`}`,
    hook: pair.hook,
    lead: pair.lead,
    pickThem: { name: s.name, points: s.pickThem },
    pickFeega: pair.pickFeega,
    sections: [
      { heading: a.setupHeading, html: a.setupHtml },
      pair.together,
      { heading: a.askHeading, html: a.askHtml },
      { heading: s.winsHeading, html: s.winsHtml },
      related(s, a, siblings, otherSubject)
    ],
    mistakes: [s.mistakes[AGENTS.indexOf(a) % s.mistakes.length], ...a.mistakes],
    questions: [s.questions[AGENTS.indexOf(a) % s.questions.length]],
    sources: [...s.sources, ...a.sources, FEEGA_DOCS_SOURCE],
    checked: HUB_CHECKED
  };

  return [slug, article, rich];
}

const AGENTS: readonly Agent[] = [CLAUDE_CODE, CODEX, CURSOR];

const SUBJECTS: readonly [Subject, Subject][] = [
  [LOVABLE, FRAMER],
  [FRAMER, LOVABLE]
];

const BUILT = SUBJECTS.flatMap(([s, other]) => AGENTS.map((a) => build(s, a, other, AGENTS.filter((x) => x !== a))));

export const AGENT_ARTICLES: Readonly<Record<string, Article>> = Object.fromEntries(BUILT.map(([slug, article]) => [slug, article]));

export const AGENT_RICH: Readonly<Record<string, Rich>> = Object.fromEntries(BUILT.map(([slug, , rich]) => [slug, rich]));
