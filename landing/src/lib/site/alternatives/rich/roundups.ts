import { VisualKind, table, type Rich } from '../alternative';
import { BUTTON_DIFF, CHANGES_VISUAL, EDITOR_VISUAL, LAYERS_MENU_VISUAL, OWN_STEPS, PROPERTIES_VISUAL, RESPONSIVE_VISUAL, TAILWIND_DIFF } from './shared';

const roundupCost = (what: string): Rich['cost'] => ({
  heading: 'What it costs',
  paragraphs: [
    `${what} The prices on this page are the ones each company published on the date shown, and they change. Check the source links at the bottom before you decide.`,
    'Feega is free and open source under Apache-2.0. It has no AI and no tokens, so a hand edit costs nothing to make.'
  ]
});

export const VISUAL_EDITORS: Rich = {
  verdict:
    'Six tools now edit the app you shipped instead of a drawing of it, and they are not interchangeable. Pick on three things: where it runs, who presses save, and what your repo receives. If you live in an IDE, Cursor Design Mode fits. If you work alone on a Mac, Onlook does. If your design system lives in Figma, wait for Make local to leave beta. If you want a Properties bar inside your editor and a diff for every change, that is Feega.',
  snapshotHeading: 'Who each editor is for',
  snapshot: table(
    ['Tool', 'Best for', 'Watch out for'],
    [
      ['Feega', 'Click-and-set edits inside VS Code, Cursor, Windsurf or VSCodium', 'No shared editing yet'],
      ['Onlook', 'A solo developer on a Mac who wants pull requests in one press', 'macOS only'],
      ['Cursor Design Mode', 'Developers who want an agent to make the edit', 'Needs Cursor and a running dev server'],
      ['Figma Make local', 'Teams whose system lives in Figma', 'Closed beta on the Mac desktop app'],
      ['Gui', 'Developers who want a local tool with their own agent', 'Alpha'],
      ['Builder.io', 'Teams that want approvals and a pull request flow', 'Priced per user']
    ]
  ),
  highlights: [
    {
      heading: 'The real question is who presses save',
      paragraphs: [
        'Some tools leave the commit to you or your agent. That suits a developer who reviews diffs where they code. Others write the commit or the pull request themselves, which suits a designer who should never see a terminal.',
        'Decide who will use the tool most before you compare features, because that person’s comfort with git settles more than any row in a table.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'The tool commits for you', steps: ['Edit visually', 'The tool writes a commit or a pull request', 'A reviewer approves'] },
        us: { title: 'The edit stays a diff', steps: ['Edit visually', 'Read the diff in Changes', 'Keep or undo it', 'Commit with your own tools'] }
      },
      caption: 'Neutral illustration of two ways a visual edit reaches a repo.'
    },
    {
      heading: 'A Properties bar in your editor',
      paragraphs: [
        'Feega is built for people who think in controls. Layers on the left, the running page in the middle, and a Properties bar for spacing, colour, type and layout.',
        'It runs in VS Code, Cursor, Windsurf and VSCodium on any OS, or as npx feega in the browser, and works with SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro and Vite.'
      ],
      visual: EDITOR_VISUAL,
      caption: 'The Feega editor: layers, the live page and Properties.'
    },
    {
      heading: 'Every change is a diff',
      paragraphs: [
        'Feega writes each edit to your source and shows it in Changes as a diff. You keep it or undo it before anything is committed.',
        'It handles plain CSS and Tailwind classes, and the same click writes the same line, because there is no model deciding what to write.'
      ],
      visual: TAILWIND_DIFF,
      caption: 'A Tailwind edit as a diff.'
    }
  ],
  cost: roundupCost('Cursor is free to start with Plus at $8 a month; Builder.io’s Pro is $24 per user a month; Onlook is free self-hosted; Figma Make local is free in beta; Gui is free in alpha.'),
  stepsHeading: 'Try the editor on your own repo in five steps',
  steps: OWN_STEPS,
  closing: 'Test them on your messy, real repo, not on a template.',
  moreQuestions: [
    { q: 'What should I test on?', a: 'Your own repo, and the tenth edit, not the first. Tools differ most on messy real code.' },
    { q: 'Do these tools replace Figma?', a: 'No. They edit what exists. Figma is for designing what does not exist yet.' },
    { q: 'Which frameworks does Feega support?', a: 'SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro and Vite, with CSS or Tailwind.' }
  ]
};

export const AI_BUILDER_OR_REPO: Rich = {
  verdict:
    'AI site builders are the right answer when there is nothing yet: you describe it and get a live URL. They are the wrong answer for the site you already have, because a builder gives you a second codebase and the one your customers use stops being the one you edit. If you have a repo and a team that reviews code, edit the repo.',
  snapshotHeading: 'Who each is for',
  snapshot: table(
    ['Tool', 'Best for', 'Watch out for'],
    [
      ['v0', 'Chatting on Vercel; it imports a GitHub repo', 'Free allows 7 messages a day'],
      ['Lovable', 'A hosted full-stack app from a prompt', 'GitHub sync creates a new repository'],
      ['Google AI Studio Build', 'A new app with Firebase set up', 'Its pages do not say it imports a repo'],
      ['Framer', 'A marketing page by tonight', 'Not your codebase'],
      ['Feega', 'Changing a site that already lives in a repo', 'Edits; it does not generate']
    ]
  ),
  highlights: [
    {
      heading: 'The second codebase is the cost',
      paragraphs: [
        'A builder hands you a new codebase. If you already have one, you now maintain two, and every fix has to land in both or drift apart.',
        'The hidden cost is review. Code a team has read and trusted is replaced by code generated from a prompt, and nobody has read that yet.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Rebuild with a builder', steps: ['Describe the site', 'Get a new codebase', 'Move content across', 'Keep two copies in step'] },
        us: { title: 'Edit what you have', steps: ['Open the repo', 'Click what needs to change', 'Set the value', 'Review the diff'] }
      },
      caption: 'Neutral illustration of the two paths.'
    },
    {
      heading: 'Judge on the tenth edit',
      paragraphs: [
        'Every builder demos a blank start, and every blank start looks great. The question is what happens when you change the tenth thing, with real content and a real design system in place.',
        'A hand edit has a good answer: it changes the one value you set and nothing else.'
      ],
      visual: BUTTON_DIFF,
      caption: 'A Feega edit is one value and one line.'
    },
    {
      heading: 'Drag a change, do not prompt it',
      paragraphs: [
        'Feega gives you layers, the live page and a Properties bar inside VS Code, Cursor, Windsurf or VSCodium, on any OS. Click, set a value, read the diff.',
        'There is no AI, so no messages to count and no tokens to buy.'
      ],
      visual: PROPERTIES_VISUAL,
      caption: 'The Properties bar for a selected element.'
    }
  ],
  cost: roundupCost('v0 is free for 7 messages a day; Lovable gives 5 credits a day; AI Studio’s first two apps are free; Framer’s Basic is $10 a month.'),
  stepsHeading: 'Try editing your own repo in five steps',
  steps: OWN_STEPS,
  closing: 'Start from a prompt if you have nothing. Start from your repo if you do.',
  moreQuestions: [
    { q: 'When is a builder the better choice?', a: 'When there is no code yet and you want a live URL today.' },
    { q: 'Can I move a builder’s output into my repo?', a: 'Often, but you then own two histories. Decide before you start.' },
    { q: 'Does Feega host anything?', a: 'No. You keep your own hosting.' }
  ]
};

export const DESIGN_HANDOFF: Rich = {
  verdict:
    'The handoff is where designs go to be rebuilt. Tools that make the spec cleaner shorten it, and tools that start from code skip it. If you design new screens from nothing, a design-first tool is right. If designs keep drifting from what shipped, start from the code.',
  snapshotHeading: 'Who each is for',
  snapshot: table(
    ['Tool', 'Best for', 'Watch out for'],
    [
      ['Figma Dev Mode', 'Developers reading specs from a shared library', 'Reads code through MCP; does not edit your repo'],
      ['Claude Design', 'New designs that Claude Code builds', 'Reads your repo; does not write to it'],
      ['Stitch', 'New screens by prompt and voice', 'Stitch Loop is a waitlist'],
      ['Pencil.dev', 'Designing in a .pen file in your IDE', 'Imports apps and HTML; output is HTML and Tailwind'],
      ['Feega', 'Editing what shipped, written as a diff', 'No generation, no shared editing yet']
    ]
  ),
  highlights: [
    {
      heading: 'A smaller handoff, or none',
      paragraphs: [
        'A cleaner spec is still a spec that someone rebuilds. Dev Mode, Claude Design and Stitch shorten the trip from design to code. They do not remove it.',
        'Starting from code removes it. If the page is the design, there is nothing to hand off.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Design first', steps: ['Design a screen', 'Hand off a spec or bundle', 'A developer rebuilds it', 'Compare to the design'] },
        us: { title: 'Code first', steps: ['Open the shipped page', 'Click and set a value', 'Review the diff', 'Done'] }
      },
      caption: 'Neutral illustration of the two paths.'
    },
    {
      heading: 'Test on the screen you shipped last year',
      paragraphs: [
        'Every design tool looks good on a new screen. Code-first tools show their worth on an old one, with its odd states and its accumulated CSS.',
        'Feega works on the running page with your own components, so what you see is what you ship.'
      ],
      visual: CHANGES_VISUAL,
      caption: 'The Changes tab lists each edit with a diff and a revert button.'
    },
    {
      heading: 'The change as code, not as a spec',
      paragraphs: [
        'Each Feega edit lands in your source as a diff you can read, keep or undo. A developer reviews a diff, not a redline.',
        'It writes CSS or Tailwind and works with SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro and Vite.'
      ],
      visual: BUTTON_DIFF,
      caption: 'One edit, one diff.'
    }
  ],
  cost: roundupCost('Figma is priced by plan; Claude Design is included in Claude plans; Stitch’s pages do not state a price; Pencil.dev has a free web version.'),
  stepsHeading: 'Try skipping the handoff in five steps',
  steps: OWN_STEPS,
  closing: 'Designs go to be rebuilt. Edit the code and skip the trip.',
  moreQuestions: [
    { q: 'Does Claude Design edit my repo?', a: 'No. It reads it to learn your design system and designs in its own project.' },
    { q: 'Should I drop Figma?', a: 'Not if you design new UI there. Use code-first tools for what has shipped.' },
    { q: 'Is Feega a design tool?', a: 'It edits a running app. It does not generate or propose designs.' }
  ]
};

export const DESIGN_WITH_CLAUDE_CODE: Rich = {
  verdict:
    'Claude Code writes the code, and something still has to show you the design. The four setups disagree on one thing: what is the source of truth. Claude Design and Figma keep the design as the source. Cursor Design Mode and Feega keep the code. Decide which one wins before the first change, and let Claude Code write the first draft.',
  snapshotHeading: 'Who each is for',
  snapshot: table(
    ['Setup', 'Source of truth', 'Best for'],
    [
      ['Claude Design', 'The Claude Design project', 'New products with no code yet'],
      ['Figma MCP', 'The Figma file', 'Teams whose design already lives in Figma'],
      ['Cursor Design Mode', 'Your code', 'Agent-driven edits inside Cursor'],
      ['Feega', 'Your code', 'Hand adjustments after the agent has written the draft']
    ]
  ),
  highlights: [
    {
      heading: 'Pick the winner before you start',
      paragraphs: [
        'If the design and the code can both change, one of them has to win, or you will spend a week reconciling them. That is true whoever writes the code.',
        'With the code as the source, the agent and the designer touch the same files, and a diff shows who changed what.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Design as the source', steps: ['Change the design', 'Ask Claude Code to rebuild', 'Compare the result', 'Repeat'] },
        us: { title: 'Code as the source', steps: ['The agent writes the draft', 'A person adjusts by hand', 'Read the diff', 'Commit'] }
      },
      caption: 'Neutral illustration of the two arrangements.'
    },
    {
      heading: 'Designers see what the agent changed',
      paragraphs: [
        'An agent can change a page faster than anyone can review a diff of CSS. Feega shows the page itself, running, with layers and a Properties bar, so a designer can see and move what the agent did.',
        'It runs in VS Code, Cursor, Windsurf and VSCodium, so it sits next to wherever Claude Code is running.'
      ],
      visual: LAYERS_MENU_VISUAL,
      caption: 'The Layers menu: duplicate, wrap, unwrap and delete elements.'
    },
    {
      heading: 'Same files, no AI of its own',
      paragraphs: [
        'Feega and Claude Code work on the same files. Feega has no AI and spends no tokens; it writes your hand edits to the source, and Claude Code can read the result on its next turn.',
        'That keeps the agent’s budget for the work only an agent can do.'
      ],
      visual: TAILWIND_DIFF,
      caption: 'A hand edit the agent can read afterwards.'
    }
  ],
  cost: roundupCost('Claude Design is included in Claude plans; Figma needs a seat; Cursor’s Plus is $8 a month.'),
  stepsHeading: 'Add Feega next to Claude Code in five steps',
  steps: OWN_STEPS,
  closing: 'Let the agent write the draft. Adjust it by hand, on the real page.',
  moreQuestions: [
    { q: 'Can Claude Code use Feega?', a: 'They work on the same files. Claude Code can read what Feega wrote.' },
    { q: 'Is Claude Design included in my plan?', a: 'Yes, on every Claude plan, sharing its usage.' },
    { q: 'Which setup is best?', a: 'The one where the source of truth matches your team: design file or code.' }
  ]
};

export const FIREBASE_STUDIO: Rich = {
  verdict:
    'Firebase Studio stops on 22 March 2027, and new workspaces closed on 22 June 2026. Google points to AI Studio for prompt-built apps and Antigravity for code-heavy projects. Feega is not a Firebase replacement and does not host anything. It matters in one place only: once your code lives in your own repo, it lets you keep editing the UI visually.',
  snapshotHeading: 'The routes at a glance',
  snapshot: table(
    ['Route', 'Best for', 'Watch out for'],
    [
      ['AI Studio Build', 'Prompt-built apps with Firestore and Auth set up', 'Hosting is Cloud Run'],
      ['Antigravity', 'Code-heavy projects, with history, files and secrets carried over', 'A new IDE'],
      ['Your own repo', 'Anyone who wants no new lock-in', 'You choose the backend and hosting yourself']
    ]
  ),
  highlights: [
    {
      heading: 'Export while the workspace still opens',
      paragraphs: [
        'The first move is to get a copy of your code out. Waiting for March leaves you hurrying, and a hurried move tends to be the one that loses something.',
        'Once the code is in a repo you control, every other decision becomes reversible.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Wait', steps: ['Keep working in Firebase Studio', 'Notice the deadline', 'Rush the export'] },
        us: { title: 'Move now', steps: ['Export the code', 'Put it in your repo', 'Pick a destination', 'Keep editing'] }
      },
      caption: 'Neutral illustration of two timelines.'
    },
    {
      heading: 'Pick the destination for next year',
      paragraphs: [
        'Moving twice costs more than moving once. Choose by where the code should live in a year: on Google Cloud with Google’s tools, or in a repo you own with a backend you choose.',
        'Google’s routes are reasonable if you want to stay in its ecosystem.'
      ],
      visual: BUTTON_DIFF,
      caption: 'In your own repo, edits are plain diffs.'
    },
    {
      heading: 'Where Feega fits after the move',
      paragraphs: [
        'If you move to your own repo, Feega lets you keep changing the interface by clicking, in VS Code, Cursor, Windsurf or VSCodium. It edits CSS or Tailwind in SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro and Vite projects.',
        'It is open source under Apache-2.0 and runs locally, so it adds no new lock-in.'
      ],
      visual: RESPONSIVE_VISUAL,
      caption: 'The preview at a tablet width, with the Layers tree and Properties beside it.'
    }
  ],
  cost: roundupCost('Pricing for Google’s routes depends on your usage; read Google’s pages for current terms.'),
  stepsHeading: 'Keep editing the UI after you move, in five steps',
  steps: OWN_STEPS,
  closing: 'Move the code first. Then pick the tool that fits where it lives.',
  moreQuestions: [
    { q: 'Does Feega replace Firebase?', a: 'No. It does not host or provide a backend. It edits the front end of a project.' },
    { q: 'Can I still create a Firebase Studio workspace?', a: 'No, not since 22 June 2026.' },
    { q: 'Where does Google send people?', a: 'To AI Studio and Antigravity, per its migration page.' }
  ]
};
