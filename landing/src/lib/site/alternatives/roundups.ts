import { ArticleKind, table, type Article } from './alternative';

const CHECKED = '2026-11-18';

const S = {
  onlook: { label: 'Onlook', href: 'https://onlook.com' },
  onlookRepo: { label: 'Onlook on GitHub', href: 'https://github.com/onlook-dev/onlook' },
  cursorDesign: { label: 'Cursor Design Mode docs', href: 'https://cursor.com/docs/agent/design-mode' },
  cursorPricing: { label: 'Cursor pricing', href: 'https://cursor.com/pricing' },
  figmaMakeLocal: { label: 'Figma Make in your local codebase', href: 'https://help.figma.com/hc/en-us/articles/40775535020695-Make-in-your-local-codebase' },
  figmaDevMode: { label: 'Figma Dev Mode', href: 'https://www.figma.com/dev-mode/' },
  gui: { label: 'Gui', href: 'https://usegui.com' },
  builderPricing: { label: 'Builder.io pricing', href: 'https://www.builder.io/pricing' },
  builderFusion: { label: 'Builder.io Fusion docs', href: 'https://www.builder.io/c/docs/fusion' },
  v0Github: { label: 'v0 GitHub docs', href: 'https://v0.app/docs/github' },
  v0Pricing: { label: 'v0 pricing', href: 'https://v0.app/pricing' },
  lovableGithub: { label: 'Lovable GitHub integration', href: 'https://docs.lovable.dev/integrations/github' },
  lovablePlans: { label: 'Lovable plans', href: 'https://docs.lovable.dev/introduction/subscription-plans' },
  aiStudio: { label: 'Full-stack apps in Google AI Studio', href: 'https://blog.google/technology/developers/full-stack-vibe-coding-google-ai-studio/' },
  framerPricing: { label: 'Framer pricing', href: 'https://www.framer.com/pricing' },
  claudeDesign: { label: 'Introducing Claude Design', href: 'https://www.anthropic.com/news/claude-design-anthropic-labs' },
  claudeDesignHelp: { label: 'Get started with Claude Design', href: 'https://support.claude.com/en/articles/14604416-get-started-with-claude-design' },
  stitch: { label: 'Stitch updates', href: 'https://blog.google/technology/google-labs/stitch-updates/' },
  designMd: { label: 'DESIGN.md', href: 'https://blog.google/technology/google-labs/stitch-design-md/' },
  pencil: { label: 'Pencil.dev', href: 'https://www.pen.dev/' },
  firebaseMigration: { label: 'Migrate from Firebase Studio', href: 'https://firebase.google.com/docs/studio/migrating-project' }
} as const;

export const ROUNDUPS: Readonly<Record<string, Article>> = {
  'visual-editor-for-your-codebase': {
    kind: ArticleKind.Roundup,
    title: 'Visual editors for your real codebase (November 2026) | Feega',
    description: 'Onlook, Cursor Design Mode, Figma Make, Gui, Builder.io and Feega compared: which visual editors open your repo, and how changes land.',
    heading: 'Visual editors that work on your real code',
    hook: 'Six tools that edit the app you shipped, not a drawing of it.',
    lead: 'Edit the app you shipped, not a drawing of it. Most design tools start from a blank frame and end at a handoff. A newer group opens your repo, runs it, and changes the source.',
    pickThem: {
      name: 'an IDE or desktop tool',
      points: ['You already live in Cursor and run the dev server yourself.', 'You work alone, on a Mac.', 'You commit and review diffs where you code.']
    },
    pickFeega: [
      'Designers who never open a terminal need to change real pages.',
      'The team edits together, on the desktop or in the browser.',
      'Every change should end up as a commit you can read and revert.'
    ],
    sections: [
      {
        heading: 'Six editors side by side',
        html: table(
          ['', 'Feega', 'Onlook', 'Cursor Design Mode', 'Figma Make local', 'Gui', 'Builder.io'],
          [
            ['Where it runs', 'VS Code, Cursor, Windsurf, VSCodium, or npx', 'Mac app', 'Cursor', 'Figma desktop beta, Mac', 'Mac and Linux, alpha', 'Browser, VS Code'],
            ['Opens your repo', 'Your open folder', 'Local or GitHub', 'Your open project', 'Folder or GitHub clone', 'Your folder', 'GitHub, GitLab, Bitbucket, Azure'],
            ['How changes land', 'Edits your files as a diff; you commit', 'One-press pull request', 'Your agent edits; you commit', 'A commit per prompt', 'Your agent edits; you commit', 'Pull request after approval'],
            ['Open source', 'Apache-2.0', 'Apache-2.0', 'No', 'No', 'Apache-2.0', 'Not stated'],
            ['Price to start', 'Free locally', 'Free self-hosted', 'Free; Plus $8 a month', 'Free in beta', 'Free in alpha', 'Free; Pro $24 per user a month']
          ]
        )
      },
      {
        heading: 'The real question is who presses save',
        html: '<p>Feega, Cursor and Gui write to your files and leave the commit to you or your agent: every change shows up as a diff you review. Onlook and Builder.io write the commit or the pull request themselves.</p>'
      },
      {
        heading: 'Protect the branch people share',
        html: '<p>Check where the first edit lands before you make it. Figma Make commits locally on every prompt. Feega never commits or pushes: it edits the files on whatever branch you have checked out.</p>'
      },
      {
        heading: 'Which one fits',
        html: table(
          ['Your sticking point', 'Start here'],
          [
            ['I live in my IDE', 'Cursor Design Mode'],
            ['Everything local, on a Mac, alone', 'Onlook'],
            ['My design system lives in Figma', 'Figma Make local, once it leaves beta'],
            ['Designers and developers on one repo', 'Feega']
          ]
        )
      }
    ],
    mistakes: [
      { q: 'Testing on a template.', a: 'These tools differ on your messy, real repo. Use that.' },
      { q: 'Ignoring the framework list.', a: 'Feega tests Next.js, SvelteKit, React, Vue, Nuxt, React Router and Astro, plus Vite without a framework. Angular and Create React App are not supported. Check yours first.' }
    ],
    questions: [
      { q: 'Can I edit my site visually without leaving the code?', a: 'Yes. All six write to the source files themselves.' },
      { q: 'Which ones open pull requests by themselves?', a: 'Onlook and Builder.io. Feega writes to your files and leaves the commit to you.' },
      { q: 'Do I need a Mac?', a: 'For Onlook and Figma Make local, yes. Not for Feega or Builder.io.' }
    ],
    sources: [S.onlook, S.onlookRepo, S.cursorDesign, S.cursorPricing, S.figmaMakeLocal, S.gui, S.builderPricing, S.builderFusion],
    checked: CHECKED
  },
  'ai-site-builder-or-your-repo': {
    kind: ArticleKind.Roundup,
    title: 'AI site builders vs editing your existing repo (2026) | Feega',
    description: 'ChatGPT Sites, v0, Lovable, Google AI Studio and Framer build something new. When does that beat editing the site you already have?',
    heading: 'AI site builders, or the site you already have?',
    hook: 'Start from a prompt if you have nothing. Start from your repo if you do.',
    lead: 'Start from a prompt if you have nothing. Start from your repo if you do. v0, Lovable, Google AI Studio and Framer build something new and host it. Feega edits the site you already ship.',
    pickThem: {
      name: 'an AI builder',
      points: ['There is no code yet.', 'You want a live URL today.', 'You would rather describe than design.']
    },
    pickFeega: ['The site already exists in a repo.', 'Your team reviews code before it ships.', 'You want to drag a change, not prompt it.'],
    sections: [
      {
        heading: 'Five builders and your own repo',
        html: table(
          ['', 'v0', 'Lovable', 'AI Studio Build', 'Framer', 'Feega'],
          [
            ['Starts from', 'A chat, or a GitHub repo', 'A chat, or a ZIP upload', 'A chat', 'A canvas', 'Your repo'],
            ['Your existing repo', 'Import from GitHub', 'Creates a new repository', 'Not stated', 'No', 'Yes'],
            ['Where it is hosted', 'Vercel', 'Lovable Cloud', 'Google Cloud Run', 'Framer', 'Wherever you host today'],
            ['Changes land as', 'A branch and a pull request', 'Commits by a bot', 'A deploy', 'A publish', 'Commits in your repo'],
            ['Price to start', 'Free, 7 messages a day', '5 credits a day', 'First two apps free', 'Free; Basic $10 a month', 'Free locally']
          ]
        )
      },
      {
        heading: 'The second codebase is the cost',
        html: '<p>A builder gives you a new codebase. If you already have one, you now maintain two, and the one your customers use is not the one you are editing.</p>'
      },
      {
        heading: 'Which one fits',
        html: table(
          ['Your sticking point', 'Start here'],
          [
            ['No code, need a page by tonight', 'Framer'],
            ['No code, need an app with a database', 'AI Studio or Lovable'],
            ['Already on Vercel, like chatting', 'v0'],
            ['An existing repo and a team that reviews', 'Feega']
          ]
        )
      }
    ],
    mistakes: [
      { q: 'Regenerating a site to change a button.', a: 'You lose the review you had, and the code drifts.' },
      { q: 'Picking on the demo.', a: 'Every builder demos a blank start. Test the tenth edit.' }
    ],
    questions: [
      { q: 'Can v0 edit my existing repo?', a: 'Yes. It imports from GitHub and opens a pull request when you publish.' },
      { q: 'Can Lovable open my GitHub repo?', a: 'Not directly. Its GitHub sync creates a new repository; to start from yours you upload a ZIP.' },
      { q: 'Does Google AI Studio import a repo?', a: 'Its pages do not say so. It builds new apps and exports to Antigravity.' }
    ],
    sources: [S.v0Github, S.v0Pricing, S.lovableGithub, S.lovablePlans, S.aiStudio, S.framerPricing],
    checked: CHECKED
  },
  'design-handoff': {
    kind: ArticleKind.Roundup,
    title: 'Design tools that skip the developer handoff (2026) | Feega',
    description: 'Figma Dev Mode, Claude Design, Stitch, Pencil.dev and Feega: which shorten the design-to-code handoff, and which skip it.',
    heading: 'Design tools that skip the handoff',
    hook: 'The handoff is where designs go to be rebuilt.',
    lead: 'The handoff is where designs go to be rebuilt. Figma Dev Mode, Claude Design and Stitch shorten it. Pencil.dev and Feega start from code and skip it.',
    pickThem: {
      name: 'a design-first tool',
      points: ['You design new screens from nothing.', 'A team shares a Figma library.', 'Developers like working from a spec.']
    },
    pickFeega: ['The product already exists.', 'Designs drift from what shipped.', 'You want the change as code, not as a spec.'],
    sections: [
      {
        heading: 'Five tools side by side',
        html: table(
          ['', 'Figma Dev Mode', 'Claude Design', 'Stitch', 'Pencil.dev', 'Feega'],
          [
            ['You design on', 'A Figma file', 'A Claude project', 'A Stitch canvas', 'A .pen file in your IDE', 'Your running app'],
            ['Reads your code', 'Through its MCP server', 'Links a repo or syncs a folder', 'Brings in a codebase', 'Imports apps and HTML', 'Runs the repo'],
            ['The developer gets', 'Specs and code hints', 'A bundle for Claude Code', 'Export to Antigravity or Netlify', 'HTML and Tailwind', 'A commit'],
            ['Price to start', 'Figma plans', 'Included in Claude plans', 'Not stated', 'Free web version', 'Free locally']
          ]
        )
      },
      {
        heading: 'A smaller handoff, or none',
        html: '<p>Claude Design learns your components, then makes new designs that Claude Code builds. Feega edits the components in place. The first is better for something new, the second for something that exists.</p>'
      }
    ],
    mistakes: [
      { q: 'Counting export formats.', a: 'A cleaner spec is still a spec someone rebuilds.' },
      { q: 'Testing on a new screen.', a: 'Code-first tools show their worth on the screen you shipped last year.' }
    ],
    questions: [
      { q: 'Does Claude Design edit my repo?', a: 'No. It reads it to learn your design system, then designs in its own project.' },
      { q: 'What is DESIGN.md?', a: 'A design-rules file format Google published as a draft spec with Stitch.' }
    ],
    sources: [S.figmaDevMode, S.claudeDesign, S.claudeDesignHelp, S.stitch, S.designMd, S.pencil],
    checked: CHECKED
  },
  'design-with-claude-code': {
    kind: ArticleKind.UseCase,
    title: 'Designing with Claude Code: four setups compared | Feega',
    description: 'Claude Design, Figma MCP, Cursor Design Mode or Feega: four ways to let Claude Code design, and which one keeps your code as the source.',
    heading: 'Designing with Claude Code: the four ways in',
    hook: 'Claude Code writes the code. Something still has to show you the design.',
    lead: 'Claude Code writes the code. Something still has to show you the design. There are four common setups, and they disagree on one thing: what the source of truth is.',
    pickThem: {
      name: 'a design-first setup',
      points: ['The product is new and there is no code yet.', 'Your design already lives in Figma.', 'You want slides or a PDF from the same work.']
    },
    pickFeega: ['Your code is the source of truth.', 'Designers should see and move what the agent changed.', 'The agent and the designer work on the same canvas.'],
    sections: [
      {
        heading: 'Four setups side by side',
        html: table(
          ['', 'Claude Design', 'Figma MCP', 'Cursor Design Mode', 'Feega'],
          [
            ['Source of truth', 'The Claude Design project', 'The Figma file', 'Your code', 'Your code'],
            ['Where you see changes', 'In Claude Design', 'In Figma', 'In the IDE browser', 'In your running app'],
            ['Hand edits', 'Sliders, comments, edits', 'Full Figma', 'Annotations', 'Properties bar, double-click text'],
            ['Extra cost', 'None on Claude plans', 'A Figma seat', 'A Cursor plan', 'Free']
          ]
        )
      },
      {
        heading: 'Pick the winner before you start',
        html: '<p>If the design and the code can both change, one of them has to win. Claude Design and Figma keep the design as the source. Cursor and Feega keep the code. Claude Code writes the first draft; Feega is where you adjust it by hand.</p>'
      }
    ],
    mistakes: [
      { q: 'Two sources of truth.', a: 'Decide which one wins before the first change.' },
      { q: 'Letting the agent design blind.', a: 'It needs to see the page. All four solve that differently.' }
    ],
    questions: [
      { q: 'Is Claude Design included in my Claude plan?', a: 'Yes, on every plan, sharing that plan’s usage.' },
      { q: 'Can Claude Code use Feega?', a: 'They work on the same files. Feega has no AI of its own: it writes your hand edits to the source, and Claude Code can read the result.' }
    ],
    sources: [S.claudeDesign, S.claudeDesignHelp, S.figmaDevMode, S.cursorDesign, S.cursorPricing],
    checked: CHECKED
  },
  'firebase-studio-shutting-down': {
    kind: ArticleKind.UseCase,
    title: 'Firebase Studio is shutting down: where to move your app | Feega',
    description: 'Firebase Studio stops on 22 March 2027. What Google recommends, and what each route means for the code you already have.',
    heading: 'Firebase Studio is shutting down: where your app can go',
    hook: 'Firebase Studio stops on 22 March 2027. Here is what each route means.',
    lead: 'Firebase Studio stops on 22 March 2027, and new workspaces closed on 22 June 2026. Google points to AI Studio and Antigravity. Feega is not a Firebase replacement; it appears in one row only, as a way to keep editing the UI.',
    pickThem: {
      name: 'a Google route',
      points: ['You built by prompting and want Firebase Auth and Firestore set up for you (AI Studio).', 'You want an IDE with your history, files and secrets carried over (Antigravity).', 'You plan to stay on Google Cloud.']
    },
    pickFeega: ['You moved the code to your own repo.', 'You want to keep editing the UI visually after the move.', 'You do not want a new lock-in: it is open source and runs locally.'],
    sections: [
      {
        heading: 'Three routes side by side',
        html: table(
          ['', 'AI Studio Build', 'Antigravity', 'Your own repo'],
          [
            ['Recommended by Google for', 'Prompt-built apps', 'Code-heavy projects', 'Not listed'],
            ['Backend', 'Firestore and Auth set up', 'Your choice', 'Your choice'],
            ['Hosting', 'Cloud Run', 'Your choice', 'Your choice'],
            ['Visual editing after', 'Annotations on the preview', 'No', 'Feega, Cursor Design Mode, Onlook']
          ]
        )
      }
    ],
    mistakes: [
      { q: 'Waiting for March.', a: 'Export while the workspace still opens.' },
      { q: 'Moving twice.', a: 'Pick the destination by where the code should live in a year.' }
    ],
    questions: [
      { q: 'When does Firebase Studio shut down?', a: '22 March 2027, according to Google’s migration page.' },
      { q: 'Can I still create a workspace?', a: 'No, not since 22 June 2026.' }
    ],
    sources: [S.firebaseMigration, S.aiStudio],
    checked: CHECKED
  }
};
