import { EditorShotId } from '../editor-shots';
import { Agent, Tool, type Variant } from './variant';

export const CHECKED = '2026-11-22';

export const CHECKED_LABEL = '22 November 2026';

const FEEGA_RUNS = 'Runs on your machine in VS Code, Cursor, Windsurf or VSCodium, or with npx feega';

const FEEGA_FREE = 'Free, open source under Apache-2.0, no account';

export const VARIANTS: readonly Variant[] = [
  {
    slug: 'lovable-alternative-for-claude-code',
    title: 'The open-source & local Lovable alternative for Claude Code users',
    h1: 'Keep the app Claude Code built. Edit it visually, without moving it to Lovable.',
    subhead:
      'Feega is a free, open-source extension that edits your running app and writes each change to your files. Claude Code keeps writing structure in the same repo, and no hosted project has to hold a second copy.',
    agent: Agent.ClaudeCode,
    tool: Tool.Lovable,
    shot: EditorShotId.Selected,
    meta: {
      title: 'Lovable alternative for Claude Code users | Feega',
      description: 'Free, open-source and local: edit the app Claude Code built by clicking it, with every change written to your repo as a diff. No Lovable project.'
    },
    differentiators: [
      {
        heading: 'Your repo stays the source of truth',
        text: 'Lovable’s GitHub sync creates a new repository and cannot link one you already have, so a Claude Code project would arrive as a ZIP upload. Feega opens the folder where Claude Code already works and edits it in place, on whatever branch you are on.'
      },
      {
        heading: 'Commits stay yours',
        text: 'Commits from a Lovable sync are authored by lovable-dev[bot]. Feega writes files and never commits, so the history shows the identity you commit with and nothing else.'
      },
      {
        heading: 'Values by hand, structure by agent',
        text: 'A padding or a heading size through Claude Code costs a prompt and tokens. In Feega you click the element, type the value and read the diff. When the next job is structure, right-click the element, choose Copy for agent and paste it into Claude Code.'
      }
    ],
    strip: [
      { aspect: 'Where the code lives', tool: 'In a Lovable project, synced to a new GitHub repository', feega: 'In your repo, on your disk, where Claude Code already works' },
      { aspect: 'Cost', tool: `Free has 5 daily build credits, Pro is $25 a month (checked ${CHECKED_LABEL})`, feega: `${FEEGA_FREE}. Claude Code stays on your own Claude plan or API usage` },
      { aspect: 'Git', tool: 'One synced branch at a time, and a ZIP upload to import code', feega: 'Plain git on any branch. Feega never commits' },
      { aspect: 'Visual editing', tool: 'Prompt, then preview the result', feega: 'Click an element, set its values, read the diff' },
      { aspect: 'Where it runs', tool: 'Hosted project', feega: FEEGA_RUNS }
    ],
    keepTool: 'Keep Lovable when there is no code yet and you want a hosted first version from a prompt.',
    faq: [
      {
        q: 'Can Feega replace Lovable if Claude Code already wrote my app?',
        a: 'For the visual part, yes. Feega edits spacing, size, colour, radius and type on the running page and writes them to your files. It does not build an app from a prompt, which is what Lovable is for, and Claude Code already does that part in your repo.'
      },
      {
        q: 'Does Feega need Claude Code or any other AI?',
        a: 'No. Feega has no model and spends no tokens. Claude Code is optional: right-click an element and choose Copy for agent to hand it the file, line and selector, then let it write the structure.'
      },
      {
        q: 'What happens to the changes I make in Feega?',
        a: 'Each edit becomes a change in your files, such as a Tailwind class or a rule in the component’s style block. The Changes tab shows the diff, and you can undo it before you commit.'
      },
      {
        q: 'Do I have to give up my Claude Code setup?',
        a: 'No. Your CLAUDE.md, your skills and your branches are untouched, because Feega only edits files in the folder you open. Keep class names literal on elements you plan to tweak so Feega can trace a click to one line.'
      },
      {
        q: 'Is it free, and what is Feega Cloud?',
        a: 'The extension and npx feega are free, with no account. Feega Cloud, with GitHub sync, collaboration, sections and templates, is coming soon.'
      }
    ]
  },
  {
    slug: 'lovable-alternative-for-codex',
    title: 'The open-source & local Lovable alternative for Codex users',
    h1: 'Codex writes the code. Feega lets you touch up the page. No Lovable project needed.',
    subhead:
      'A terminal agent cannot see your browser. Feega shows the running page, points at the source line behind each element and writes your edits to the files Codex works on, locally and for free.',
    agent: Agent.Codex,
    tool: Tool.Lovable,
    shot: EditorShotId.Overview,
    meta: {
      title: 'Lovable alternative for Codex users | Feega',
      description: 'A free, open-source, local way to edit the page Codex built: click it, set the value, keep the diff. No hosted Lovable project and no credits.'
    },
    differentiators: [
      {
        heading: 'Local on both sides',
        text: 'Codex CLI, the IDE extension and the desktop app work on a local repository, and so does Feega. Lovable keeps the project in its own hosted workspace, so a Codex repo would need a ZIP upload before Lovable could touch it.'
      },
      {
        heading: 'The page Codex cannot see',
        text: 'In a terminal, Codex reads files, not pixels. Feega adds the running page: click the hero button and it marks the file and line, then you set the padding by eye. Codex reads the new value the next time it opens the file.'
      },
      {
        heading: 'No credits to count',
        text: 'Lovable’s free plan lists 5 build credits a day, with a monthly cap of 30, and Pro starts at $25 a month. Codex signs in with a ChatGPT plan or an API key, and Feega adds nothing to either bill: it has no model and no account.'
      }
    ],
    strip: [
      { aspect: 'Where the code lives', tool: 'In a Lovable project, mirrored to a new repository', feega: 'In your local repo, next to the Codex session' },
      { aspect: 'Cost', tool: `Free has 5 daily build credits, Pro from $25 a month (checked ${CHECKED_LABEL})`, feega: `${FEEGA_FREE}. Codex runs on a ChatGPT plan or an API key` },
      { aspect: 'Git', tool: 'ZIP in, new repository out, one branch at a time', feega: 'Your own git. Codex suggests checkpoints, and you commit' },
      { aspect: 'Seeing the result', tool: 'Preview after each prompt', feega: 'The running page in the editor, with the Properties bar beside it' },
      { aspect: 'Where it runs', tool: 'Hosted project', feega: 'Local. Pair it with Codex CLI, the IDE extension or the desktop app' }
    ],
    keepTool: 'Keep Lovable for a first version from a prompt, before any repo exists.',
    faq: [
      {
        q: 'Does Feega work with Codex Web?',
        a: 'Pair Feega with the Codex CLI, the IDE extension or the desktop app. Codex Web runs in the cloud, and Feega edits files on your machine and needs your local dev server.'
      },
      {
        q: 'How do I hand an element to Codex?',
        a: 'Right-click the element in Feega and choose Copy for agent. Paste the file, line and selector into your prompt, and Codex starts from the exact element you picked.'
      },
      {
        q: 'Will Feega and Codex overwrite each other?',
        a: 'Only if you both edit the same line at once. Let Codex finish, run git diff so it starts from the files as they are now, then make your visual change. Feega shows every edit in Changes.'
      },
      {
        q: 'Why not move my Codex project into Lovable?',
        a: 'Lovable’s sync always creates a new repository, so you would keep two copies of the app and one of them would carry commits from lovable-dev[bot]. Feega edits the repo you already have.'
      },
      {
        q: 'Which frameworks does Feega support?',
        a: 'React, Next.js, SvelteKit, Vue, Nuxt, React Router, Astro and Vite, styled with Tailwind or plain CSS. Angular, plain static HTML without Vite and Create React App are not supported.'
      }
    ]
  },
  {
    slug: 'lovable-alternative-for-cursor',
    title: 'The open-source & local Lovable alternative for Cursor users',
    h1: 'Visual edits inside Cursor, on your own repo, instead of a Lovable project.',
    subhead:
      'Feega installs in Cursor as an extension, so the agent pane and the Properties bar share one window. You set the value by hand, the file changes at once, and nothing is uploaded anywhere.',
    agent: Agent.Cursor,
    tool: Tool.Lovable,
    shot: EditorShotId.Changes,
    meta: {
      title: 'Lovable alternative for Cursor users | Feega',
      description: 'Free, open-source and local: edit your app visually inside Cursor and keep every change as a diff in your repo. No Lovable project, no credits.'
    },
    differentiators: [
      {
        heading: 'One window, two jobs',
        text: 'Cursor’s agent searches files, edits them, runs shell commands and keeps checkpoints. Feega adds the part that is easier to do than to describe: select the element and change its values. Both sit in the same Cursor window.'
      },
      {
        heading: 'Design Mode sends a note, Feega writes a value',
        text: 'Cursor’s Design Mode sends your annotation, the selector, size and key styles, and a screenshot to the agent, which decides what to change. When you already know the number, Feega lets you type it and the file changes with no model in between.'
      },
      {
        heading: 'No second copy of the app',
        text: 'Lovable’s sync covers one branch at a time and cannot link an existing repository. Cursor already works in your workspace, so there is no reason to move the app into a hosted project to nudge a margin.'
      }
    ],
    strip: [
      { aspect: 'Where the code lives', tool: 'In a Lovable project, synced to a new repository', feega: 'In your workspace on disk, the one Cursor has open' },
      { aspect: 'Cost', tool: `Free has 5 daily build credits, Pro from $25 a month (checked ${CHECKED_LABEL})`, feega: `${FEEGA_FREE}. Cursor stays on your own Cursor plan` },
      { aspect: 'Git', tool: 'You cannot switch branches while Lovable is editing', feega: 'Whatever branch you are on. Feega writes files and never commits' },
      { aspect: 'Visual editing', tool: 'Prompt, then preview the result', feega: 'Select the element, set its values, review it in Changes' },
      { aspect: 'Where it runs', tool: 'Hosted project', feega: 'An extension installed from Open VSX in Cursor, or npx feega in a terminal' }
    ],
    keepTool: 'Keep Lovable for a first version from a prompt, when there is no workspace yet.',
    faq: [
      {
        q: 'How do I install Feega in Cursor?',
        a: 'Cursor installs extensions from Open VSX, and Feega is published there. Install it from the extensions view, or run npx feega in the project folder to open the same editor in your browser.'
      },
      {
        q: 'Is Feega a replacement for Cursor’s Design Mode?',
        a: 'No, they answer different needs. Design Mode is for intent you can only phrase in words, such as making a hero calmer. Feega is for values you can measure. Both end as a diff in the same file.'
      },
      {
        q: 'Does Feega send my code to a model?',
        a: 'No. Feega has no model and no tokens. Your edits are written deterministically, and the Cursor agent only sees them the next time it reads the file.'
      },
      {
        q: 'What does Lovable do that this setup does not?',
        a: 'Lovable turns a prompt into a hosted app, with hosting and credits managed for you. Feega and Cursor assume code already exists in your workspace and that you host it yourself.'
      },
      {
        q: 'Do I need a particular Cursor version?',
        a: 'Feega installs as a regular extension and does not depend on a version. Cursor’s own Annotate feature in Design Mode needs Cursor 3.24.18 or later, per its documentation.'
      },
      {
        q: 'Is Feega free?',
        a: 'Yes. The extension and npx feega are free, open source and need no account. Feega Cloud, with GitHub sync, collaboration, sections and templates, is coming soon.'
      }
    ]
  },
  {
    slug: 'framer-alternative-for-claude-code',
    title: 'The open-source & local Framer alternative for Claude Code users',
    h1: 'Design the page Claude Code wrote, in your repo, not on a Framer canvas.',
    subhead:
      'Framer keeps a site in a Framer project and hosts it. Feega edits a page that already lives in your code, so Claude Code and a visual editor work on the same files, with the diff in your git.',
    agent: Agent.ClaudeCode,
    tool: Tool.Framer,
    shot: EditorShotId.SvelteKit,
    meta: {
      title: 'Framer alternative for Claude Code users | Feega',
      description: 'A free, open-source, local Framer alternative for pages that live in code: click an element, edit it, and keep the diff in your repo.'
    },
    differentiators: [
      {
        heading: 'The page lives where the product lives',
        text: 'Framer publishes from its own project, and the pages we read do not describe a code export. If your landing page is a Svelte, Next.js or Vue file in the app’s repo, Feega edits that file directly and Claude Code keeps reading it.'
      },
      {
        heading: 'Claude Code driving Framer is a different job',
        text: 'Framer can be reached from Claude Code through MCP or a local CLI, but then Claude Code edits the Framer project. With the page in your repo, Claude Code edits your files, your tokens and your components, and Feega handles the visual touch-ups.'
      },
      {
        heading: 'Free tooling, your own hosting',
        text: 'Framer’s plans run from Free at $0 to Pro at $30 a month and add AI credits, a CMS, staging and hosting. Feega is free and Apache-2.0, with none of those features: you bring the hosting and keep the code.'
      }
    ],
    strip: [
      { aspect: 'Where the code lives', tool: 'In a Framer project, published to Framer hosting', feega: 'In your repo, edited by Claude Code and by Feega' },
      { aspect: 'Cost', tool: `Free $0, Basic $10, Pro $30 a month, with AI credits (checked ${CHECKED_LABEL})`, feega: `${FEEGA_FREE}. Claude Code stays on your Claude plan` },
      { aspect: 'Export and git', tool: 'Code export not described on the pages we read', feega: 'Plain git. Feega writes files and never commits' },
      { aspect: 'Who edits', tool: 'Designers on a canvas, with a CMS and staging', feega: 'Developers on a running page, with a diff for each edit' },
      { aspect: 'Where it runs', tool: 'Cloud editor and hosting', feega: FEEGA_RUNS }
    ],
    keepTool: 'Keep Framer when designers publish the site without a developer and need its CMS and hosting.',
    faq: [
      {
        q: 'Can Feega import my Framer site?',
        a: 'No. The Framer pages we read do not describe a code export, so treat the move as a rebuild. Keep the Framer site live, have Claude Code build each section in your repo, then fix spacing and type in Feega.'
      },
      {
        q: 'Is Feega a canvas like Framer?',
        a: 'No. Feega edits your running app, not a separate canvas. You click an element on the real page, change its values in the Properties bar and the change is written to the file behind it.'
      },
      {
        q: 'What do I lose by leaving Framer?',
        a: 'Framer’s paid plans add a CMS, hosting locations and staging. A page in your repo needs your own hosting, your own CMS choice or Markdown files, and your own review step.'
      },
      {
        q: 'How does Claude Code fit in?',
        a: 'Claude Code builds sections and structure in the repo, guided by your CLAUDE.md. Feega sets the values by eye. Right-click an element and choose Copy for agent to hand Claude Code the exact line.'
      },
      {
        q: 'Which stacks work with Feega?',
        a: 'React, Next.js, SvelteKit, Vue, Nuxt, React Router, Astro and Vite, with Tailwind or plain CSS. It is free, and Feega Cloud for teams is coming soon.'
      }
    ]
  },
  {
    slug: 'framer-alternative-for-codex',
    title: 'The open-source & local Framer alternative for Codex users',
    h1: 'Your Codex repo, with a visual editor. No Framer project to keep in step.',
    subhead:
      'Framer lists Codex as an external agent for a Framer project, which keeps the page in Framer. Feega keeps it in your repo: Codex edits the files locally, and you adjust the page visually on top of them.',
    agent: Agent.Codex,
    tool: Tool.Framer,
    shot: EditorShotId.React,
    meta: {
      title: 'Framer alternative for Codex users | Feega',
      description: 'Free, open-source and local: edit the page in your Codex repo visually and keep each change as a diff. No Framer project to sync.'
    },
    differentiators: [
      {
        heading: 'Codex on a repo, not on a project',
        text: 'Framer describes Codex as an agent that updates a Framer project through MCP or a local CLI setup, and Framer then publishes. On a repo, Codex inspects local files, edits them and runs the tools you already have. The page can use your components and your tests.'
      },
      {
        heading: 'What a terminal agent lacks',
        text: 'Codex sees files, not the rendered page. Feega shows the running page and marks the source line of the element you select. You set the spacing and type by eye, and Codex reads the new values on its next pass.'
      },
      {
        heading: 'A migration in four moves',
        text: 'List what the Framer page contains, ask Codex to rebuild one section in your repo, open it in Feega to adjust spacing and type, then repeat per section and switch the domain when the repo version matches. Plan to rebuild rather than convert.'
      }
    ],
    strip: [
      { aspect: 'Where the code lives', tool: 'In a Framer project', feega: 'In your local repo, next to Codex' },
      { aspect: 'Cost', tool: `Free $0, Basic $10, Pro $30 a month (checked ${CHECKED_LABEL})`, feega: `${FEEGA_FREE}. Codex runs on a ChatGPT plan or an API key` },
      { aspect: 'Export and git', tool: 'Code export not described on the pages we read', feega: 'Your own git, with checkpoints advised by Codex. You commit' },
      { aspect: 'Agent access', tool: 'Codex through MCP or a local CLI setup, editing Framer', feega: 'Codex edits your files, and Feega shows the selected element’s source' },
      { aspect: 'Where it runs', tool: 'Cloud editor and hosting', feega: 'Local. Pair it with Codex CLI, the IDE extension or the desktop app' }
    ],
    keepTool: 'Keep Framer for sites designers own and publish, where a CMS, staging and hosting on one page matter.',
    faq: [
      {
        q: 'Does Feega read my Framer project?',
        a: 'No. Feega works on code that runs in your own dev server. A Framer site would first have to be rebuilt in your repo, section by section.'
      },
      {
        q: 'Can I keep both while I move?',
        a: 'Yes, and you should. Keep the Framer site live until the repo page matches it, then switch the domain. Framer describes a reverse proxy for putting a Framer site behind your own host, which can help during the move.'
      },
      {
        q: 'What does Codex do versus Feega?',
        a: 'Codex runs commands and edits files from a terminal, an IDE extension or a desktop app. Feega sets values you can see: spacing, colour, radius and type. Use Codex for routes and forms, Feega for the finish.'
      },
      {
        q: 'Do I need AI in Feega?',
        a: 'No. Feega has no model and no tokens, and each edit is a diff you can undo. The AI cost on this path is only Codex’s own plan or API key.'
      },
      {
        q: 'Is Feega free?',
        a: 'Yes. The extension and npx feega are free and open source under Apache-2.0. Feega Cloud, with GitHub sync, collaboration, sections and templates, is coming soon.'
      }
    ]
  },
  {
    slug: 'framer-alternative-for-cursor',
    title: 'The open-source & local Framer alternative for Cursor users',
    h1: 'Click, edit, ship the diff. Inside Cursor, on code you own.',
    subhead:
      'Framer lists Cursor among the agents that can update a Framer project. With the page in your repo, Cursor and Feega share a window instead: the agent pane next to the Properties bar, on your own files.',
    agent: Agent.Cursor,
    tool: Tool.Framer,
    shot: EditorShotId.Vue,
    meta: {
      title: 'Framer alternative for Cursor users | Feega',
      description: 'A free, open-source, local Framer alternative inside Cursor: click an element on your running page, edit it, and keep the diff in your repo.'
    },
    differentiators: [
      {
        heading: 'Cursor edits your repo, not a Framer project',
        text: 'Framer’s Cursor integration drives a Framer project. Pointed at your repo, the same agent searches files, edits them, runs shell commands, checks visual changes in a browser and restores checkpoints. That is the whole build loop without a second home for the page.'
      },
      {
        heading: 'Design Mode for words, Feega for numbers',
        text: 'Cursor’s Design Mode sends your note, the element’s selector, size and key styles, and a screenshot to the agent. For a request like making the hero calmer that works well. For a padding you already know, click the element in Feega and type it.'
      },
      {
        heading: 'Know what you give up',
        text: 'Framer lists a CMS, staging, branching, localization and A/B testing as an add-on on its pricing page. A page in your repo has none of that built in. If your marketing team publishes every week from a canvas, stay on Framer.'
      }
    ],
    strip: [
      { aspect: 'Where the code lives', tool: 'In a Framer project, published to Framer hosting', feega: 'In your workspace, the one Cursor already has open' },
      { aspect: 'Cost', tool: `Free $0, Basic $10, Pro $30 a month (checked ${CHECKED_LABEL})`, feega: `${FEEGA_FREE}. Cursor stays on your own Cursor plan` },
      { aspect: 'Export and git', tool: 'Code export not described on the pages we read', feega: 'Your git, with agent checkpoints. Feega writes files and never commits' },
      { aspect: 'Visual editing', tool: 'A canvas in Framer', feega: 'The Properties bar on your own running page' },
      { aspect: 'Where it runs', tool: 'Cloud editor and hosting', feega: 'An extension installed from Open VSX in Cursor, or npx feega in a terminal' }
    ],
    keepTool: 'Keep Framer when the site belongs to designers and ships on its own schedule.',
    faq: [
      {
        q: 'Why use Feega in Cursor instead of Framer?',
        a: 'Because the page already lives in your repo, or should. Feega edits the real file behind each element, so there is no second project to keep in step with the code Cursor writes.'
      },
      {
        q: 'Does Feega replace the Cursor agent?',
        a: 'No. The agent writes structure, Feega sets values. Both write to the same file, and the agent sees your change the next time it reads it. Check each edit in Changes.'
      },
      {
        q: 'Should I delete my Framer site?',
        a: 'Not before the repo page matches it. Keep both live until the domain switch, and treat the move as a rebuild, since the Framer pages we read do not describe a code export.'
      },
      {
        q: 'Which editors and terminals does Feega run in?',
        a: 'VS Code, Cursor, Windsurf and VSCodium, or any terminal with npx feega, on macOS, Windows and Linux. Cursor installs it from Open VSX.'
      },
      {
        q: 'What does it cost?',
        a: 'Nothing for the extension: it is free, open source and needs no account. Feega Cloud, with GitHub sync, collaboration, sections and templates, is coming soon.'
      }
    ]
  }
];
