import { CalloutTone, type Extras } from '../alternative';
import { CHANGES_SHOT, EDITOR_PROPERTIES, OVERVIEW_SHOT, SELECTED_SHOT } from './shots';
import {
  BLOG_POST, CHANGES_DOCS, CLAUDE_MEMORY, CLAUDE_SKILLS, CODEX_CLI, CODEX_REPO, CURSOR_AGENT, CURSOR_DESIGN, FEEGA_AGENTS, LOVABLE_GITHUB, LOVABLE_PLANS, PROPERTIES_DOCS, QUICK_START_DOCS, cite
} from './sources';

const TRY = 'Try Feega in two minutes: run npx feega in your project folder, or install the extension.';
const DOCS_CTA = { text: 'The agent guide shows each command and what the agent can see.', label: 'Read the agent docs', href: FEEGA_AGENTS.href };
const DOWNLOAD_CTA = { text: TRY, label: 'Download Feega', href: '/download' };
const TABLE_HEAD = (agent: string) => ['', 'Lovable', `${agent} in your repo`, 'Feega'];

export const LOVABLE_CLAUDE_CODE: Extras = {
  takeaways: [
    'Lovable keeps the app in a Lovable project and syncs it to a new GitHub repository. Claude Code works in the repo you already have.',
    'Claude Code writes structure. Feega sets values by hand, so a spacing change costs no tokens.',
    'Commits stay yours: Lovable’s are authored by lovable-dev[bot], Feega never commits.',
    'Keep Lovable when there is no code yet and you want a hosted app from a prompt.'
  ],
  hero: EDITOR_PROPERTIES,
  tables: [
    {
      heading: 'Lovable, Claude Code and Feega side by side',
      head: TABLE_HEAD('Claude Code'),
      rows: [
        ['Where the code lives', `In a Lovable project, synced to a new repository (${cite(LOVABLE_GITHUB)})`, 'In your repo, on your disk', 'In your repo, on your disk'],
        ['Pricing model', `Credits: Free has 5 daily build credits, Pro starts at $25 a month (${cite(LOVABLE_PLANS)}, 22 November 2026)`, 'Your Claude plan or API usage', 'Free, Apache-2.0, no credits'],
        ['Export and git', 'Sync creates a repo; Upload code takes a ZIP', 'Plain git, any branch', 'Plain git. Feega writes files and never commits'],
        ['Local or cloud', 'Hosted project', `Runs in your terminal or editor (${cite(CLAUDE_SKILLS)})`, 'Runs on your machine, no account'],
        ['Visual editing', 'Prompt, then preview', 'No canvas', 'Click an element and set its values'],
        ['Fits', 'Starting an app from a prompt', 'Building and refactoring code', 'Nudging layout and type in an existing page']
      ],
      callout: { tone: CalloutTone.Note, title: 'Dated figures', text: 'Prices and limits are as listed on Lovable’s plans page on 22 November 2026 and can change. Check the page before you decide.' }
    }
  ],
  sections: [
    {
      heading: 'What Lovable keeps, and what Claude Code keeps',
      html: `<p>Per ${cite(LOVABLE_GITHUB)}, a Lovable project links to one repository, the sync covers one branch at a time, and you cannot switch branches while Lovable is editing. Claude Code has none of those limits because it works on a folder: any branch, any worktree, any commit you make yourself.</p><p>That difference decides where a visual tweak belongs. If the page already sits in your repo and Claude Code wrote it, opening it in Lovable first means a ZIP upload and a second copy. Opening it in Feega means clicking the element in the running page. The <a href="/alternatives/lovable">Lovable overview</a> goes through the same trade-off without an agent in the picture.</p>`,
      image: CHANGES_SHOT,
      callout: { tone: CalloutTone.Tip, title: 'Tip', text: 'Ask Claude Code to keep class names literal on elements you will tweak. Feega can then trace each click to one line.' }
    },
    {
      heading: 'A short session with both open',
      html: `<p>Say Claude Code has just built a pricing section. You open the page with Feega, click the card and see its file and line in the bar. The padding looks tight, so you change it in Properties and read the result in <a href="${CHANGES_DOCS}" rel="noopener">Changes</a> as a one line diff. Nothing was prompted and nothing was billed.</p><p>Then you want a new FAQ block under the cards. That is structure, so it goes back to Claude Code, which reads the files you just changed. If you want it to start from the exact element, right-click it in Feega and choose Copy for agent, as described in the ${cite(FEEGA_AGENTS)}. The <a href="/pricing">pricing page</a> lists what Feega itself costs.</p>`,
      cta: DOWNLOAD_CTA
    },
    {
      heading: 'Memory and skills decide how well it fits',
      html: `<p>Claude Code reads <code>CLAUDE.md</code> at the start of every session, per ${cite(CLAUDE_MEMORY)}, and a skill is a <code>SKILL.md</code> file whose body loads when it is used. Put the Feega rule in one of them: literal Tailwind classes, visible text in the markup, no class built by a function on elements people will tweak.</p><p>Lovable has its own prompt box and its own rules about what the builder may touch. With Claude Code, those rules sit in files you can commit and review. A teammate who clones the repo gets the same behavior, which is hard to promise for a hosted project. You can read how this idea started in <a href="${BLOG_POST}" rel="noopener">Design in your codebase</a>.</p>`,
      callout: { tone: CalloutTone.Warning, title: 'Warning', text: 'Do not edit the same line in Lovable and in your repo at once. Lovable syncs one branch, and a conflict there is yours to resolve.' },
      cta: DOCS_CTA
    }
  ],
  sources: [CLAUDE_SKILLS, CLAUDE_MEMORY]
};

export const LOVABLE_CODEX: Extras = {
  takeaways: [
    'Codex works on a local folder from a terminal, an IDE extension or a desktop app. Lovable works on a hosted project.',
    'A terminal agent cannot see your browser. Feega shows the running page and points at the source line.',
    'Lovable’s sync cannot link an existing repository, so a Codex project would need a ZIP upload first.',
    'Use Codex for routes, forms and refactors, and Feega for spacing, color and type.'
  ],
  hero: OVERVIEW_SHOT,
  tables: [
    {
      heading: 'Lovable, Codex and Feega side by side',
      head: TABLE_HEAD('Codex'),
      rows: [
        ['Where the code lives', `In a Lovable project, synced to a new repository (${cite(LOVABLE_GITHUB)})`, 'In your local repo', 'In your local repo'],
        ['Pricing model', `Free 5 daily build credits, Pro from $25 a month (${cite(LOVABLE_PLANS)}, 22 November 2026)`, 'Sign in with a ChatGPT plan or an API key', 'Free, Apache-2.0'],
        ['Export and git', 'New repository on connect; ZIP to import', 'Your git, with checkpoints before and after a task', 'Writes files; you commit'],
        ['Local or cloud', 'Hosted', `CLI, IDE extension and desktop app run locally; Codex Web is cloud (${cite(CODEX_REPO)})`, 'Local, needs your dev server'],
        ['Visual editing', 'Preview after each prompt', 'None in the terminal', 'Properties bar on the running page'],
        ['Fits', 'A first version from a prompt', 'Commands, edits and builds from a terminal', 'Hand edits on a page that already exists']
      ],
      callout: { tone: CalloutTone.Note, title: 'Codex Web', text: 'Codex Web runs in the cloud at chatgpt.com/codex. Feega edits files on your machine, so pair it with the CLI, the IDE extension or the desktop app.' }
    }
  ],
  sections: [
    {
      heading: 'Why a Lovable project is a poor fit for a terminal agent',
      html: `<p>${cite(CODEX_CLI)} describes a terminal tool that inspects code, makes changes and runs commands in your local repository. It also suggests creating Git checkpoints before and after a task so you can revert. That workflow assumes the repository is the source of truth.</p><p>With Lovable, the project is the source of truth and GitHub is a mirror, created new on connect and limited to one branch at a time per ${cite(LOVABLE_GITHUB)}. To bring a finished repo in, you download it as a ZIP and upload it. Codex would then edit a clone while Lovable edits the project. Skipping the builder avoids that split. See the <a href="/alternatives/lovable-alternative-for-cursor">Cursor version</a> of this page if your agent lives in an editor instead.</p>`,
      callout: { tone: CalloutTone.Tip, title: 'Tip', text: 'Run /permissions in Codex before a long task so you know what it may edit without asking.' }
    },
    {
      heading: 'Two terminals and a browser tab',
      html: `<p>A practical setup: Codex in one terminal, <code>npx feega</code> in a second, your dev server running. You click the hero button on the page and Feega marks its file and line. You set the padding by eye and check the diff in <a href="${CHANGES_DOCS}" rel="noopener">Changes</a>.</p><p>When the next job is code, run <code>git diff</code> so Codex starts from the files as they are now, then ask for the route or the form. If you want the element handed over by name, use Copy for agent and paste the file, line and selector into the prompt, as the ${cite(FEEGA_AGENTS)} describe. The <a href="${QUICK_START_DOCS}" rel="noopener">quick start</a> covers the first run, and <a href="${PROPERTIES_DOCS}" rel="noopener">the Properties page</a> lists what each row writes.</p>`,
      image: EDITOR_PROPERTIES,
      cta: DOWNLOAD_CTA
    },
    {
      heading: 'What to check before you pick Lovable over your repo',
      html: `<p>Count the credits your edits would use. ${cite(LOVABLE_PLANS)} lists 5 daily build credits on Free, with a monthly cap of 30, and Pro from $25 a month for 100 credits, or $250 a year. Pro is also where code editing and download are listed. Codex sign-in uses a ChatGPT plan or an API key, so your agent cost is separate and already on your bill.</p><p>Feega adds nothing to either meter: it has no model and no account. The <a href="/alternatives/framer-alternative-for-codex">Framer page for Codex</a> runs the same exercise for a canvas-based builder. Feega itself is free, as the <a href="/pricing">pricing page</a> shows.</p>`,
      callout: { tone: CalloutTone.Warning, title: 'Warning', text: 'A Lovable commit is authored by lovable-dev[bot]. If your team requires signed or attributed commits, check how that fits before you connect a repo.' },
      cta: DOCS_CTA
    }
  ],
  sources: [CODEX_REPO, CODEX_CLI]
};

export const LOVABLE_CURSOR: Extras = {
  takeaways: [
    'Cursor and Feega share one window, so the agent pane and the Properties bar sit side by side.',
    'Cursor Design Mode hands your note to the agent. Feega writes the value you set, with no model.',
    'Lovable would add a hosted project and a bot-authored sync to a repo you already work in.',
    'Keep Lovable for a first version from a prompt, and Cursor plus Feega for the app you ship.'
  ],
  hero: SELECTED_SHOT,
  tables: [
    {
      heading: 'Lovable, Cursor and Feega side by side',
      head: TABLE_HEAD('Cursor'),
      rows: [
        ['Where the code lives', `In a Lovable project, synced to a new repository (${cite(LOVABLE_GITHUB)})`, 'In your workspace on disk', 'In your workspace on disk'],
        ['Pricing model', `Free 5 daily build credits, Pro from $25 a month (${cite(LOVABLE_PLANS)}, 22 November 2026)`, 'Per your Cursor plan', 'Free, Apache-2.0'],
        ['Export and git', 'ZIP in, new repository out', 'Your git, with checkpoints inside the agent', 'Writes files; you commit'],
        ['Local or cloud', 'Hosted', `Desktop editor (${cite(CURSOR_AGENT)})`, 'Extension in the editor, or npx feega'],
        ['Visual editing', 'Preview after a prompt', `Design Mode: annotate, then the agent edits (${cite(CURSOR_DESIGN)})`, 'Set values yourself, see the diff'],
        ['Fits', 'A first version from a prompt', 'Changes you can describe', 'Changes you can see and measure']
      ],
      callout: { tone: CalloutTone.Note, title: 'Version', text: 'Cursor’s Annotate needs Cursor 3.24.18 or later, per its Design Mode page. Feega installs as an extension in Cursor and does not depend on that version.' }
    }
  ],
  sections: [
    {
      heading: 'Design Mode and Feega on the same page',
      html: `<p>According to ${cite(CURSOR_DESIGN)}, you click an element, leave a note, and Cursor sends the agent your text, the element’s selector, size and key styles, and a cropped screenshot. The agent then decides what to change. That suits a request you can only phrase in words, such as “make this feel calmer”.</p><p>When you already know the number, the round trip is slower than typing it. In Feega you click the same element and set the padding in Properties, and the file changes at once. The agent sees the new value the next time it reads the file, as the ${cite(FEEGA_AGENTS)} explain. Neither tool needs Lovable in the loop.</p>`,
      callout: { tone: CalloutTone.Tip, title: 'Tip', text: 'Use Design Mode for intent and Feega for values. Both end as a diff in the same file.' }
    },
    {
      heading: 'What the Cursor agent adds to a repo-first workflow',
      html: `<p>${cite(CURSOR_AGENT)} lists file search, file edits, shell commands, a browser the agent can control to check visual changes, and checkpoints you can restore. Those are the jobs Lovable’s builder does in its own project, here done in yours.</p><p>Feega covers the part the agent describes in words. Select an element, change its values, read the result in <a href="${CHANGES_DOCS}" rel="noopener">Changes</a>, keep it or undo it. If you also use a terminal agent, the <a href="/alternatives/lovable-alternative-for-claude-code">Claude Code page</a> shows how the same idea works there.</p>`,
      image: EDITOR_PROPERTIES,
      cta: DOWNLOAD_CTA
    },
    {
      heading: 'Lovable limits worth knowing before you move',
      html: `<p>${cite(LOVABLE_GITHUB)} says git sync cannot link a project to an existing repository, reconnecting after a disconnect creates another new one, and you cannot create or switch branches while Lovable is editing. ${cite(LOVABLE_PLANS)} adds that commit attribution to the member is a Business feature.</p><p>None of that blocks a Cursor user from keeping the app in their own repo. It just removes the reason to move it. The <a href="/alternatives">alternatives index</a> compares other builders, and the <a href="${QUICK_START_DOCS}" rel="noopener">quick start</a> gets Feega running in a few minutes. Feega itself is free, as the <a href="/pricing">pricing page</a> shows.</p>`,
      callout: { tone: CalloutTone.Warning, title: 'Warning', text: 'A hand edit in Feega and an agent edit in the same line will overwrite each other. Let the agent read the file before it continues.' },
      cta: DOCS_CTA
    }
  ],
  sources: [CURSOR_AGENT, CURSOR_DESIGN]
};
