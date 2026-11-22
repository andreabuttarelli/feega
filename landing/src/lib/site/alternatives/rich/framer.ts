import { VisualKind, table, type Rich } from '../alternative';
import { EDITOR_VISUAL, OWN_STEPS, RESPONSIVE_VISUAL, TAILWIND_DIFF } from './shared';

export const FRAMER: Rich = {
  verdict:
    'Framer is a design canvas that also hosts what you publish. That suits a marketing site owned by designers who never open a terminal. It suits you less when the landing page already lives in a repo and a coding agent writes it, because then the page would have two homes. Feega works on the repo you have: click the element, change it, and the edit lands in your Tailwind classes or your CSS as a diff.',
  snapshotHeading: 'Framer and Feega at a glance',
  snapshot: table(
    ['', 'Framer', 'Feega'],
    [
      ['Where the page lives', 'In a Framer project, hosted by Framer', 'In your repo, hosted wherever you host'],
      ['Source files', 'No code export or git sync on the pages we read', 'Your own files, edited in place'],
      ['Coding agents', 'Connect through MCP or a local CLI setup', 'Read the same files Feega writes'],
      ['Free plan', '$0, 500 AI credits a month, a Framer domain', 'Free, Apache-2.0, no limits'],
      ['Paid plans', 'Basic $10 a month, Pro $30 a month', 'None'],
      ['Uses AI', 'Yes, agents spend credits', 'No']
    ]
  ),
  highlights: [
    {
      heading: 'The page lives in Framer, not in your repo',
      paragraphs: [
        'On the pricing and help pages we read, Framer publishes your site to its own hosting and a domain you connect. None of those pages mentions exporting the site as code or syncing it with a git repository. If the page is a Framer project, that project is the source of truth.',
        'That works well until the landing page belongs to your product. A hero that shares components, copy and tokens with the app is one more thing to keep in step once it lives somewhere else.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Page in a canvas', steps: ['Design in Framer', 'Publish to Framer hosting', 'Copy tokens by hand', 'Repeat for each change'] },
        us: { title: 'Page in your repo', steps: ['Open the repo', 'Click the element', 'Set the value', 'Review the diff'] }
      },
      caption: 'Neutral illustration of the two paths.'
    },
    {
      heading: 'An agent can reach Framer, or reach your files',
      paragraphs: [
        'Framer’s developer page lists External Agents, which connect Claude Code, Codex or Cursor to a Framer project, and its help centre describes the setup as MCP or a local CLI. The agent then changes the Framer project.',
        'Feega leaves that choice out. The agent edits your source files as it always did, and you adjust the result by hand in the same files. Every change shows up as a diff in Changes and in git.'
      ],
      visual: TAILWIND_DIFF,
      caption: 'A hand edit in Feega, written as a class change in the component.'
    },
    {
      heading: 'Limits and hosting come with the canvas',
      paragraphs: [
        'Framer’s plans cap pages, CMS collections and bandwidth. Basic includes 30 pages and 50 GB of bandwidth, Pro 150 pages and 100 GB, with paid steps above that, as listed on its pricing page.',
        'A repo has no such caps, since you host it yourself. Whether that is a relief or a chore depends on whether you already run a deploy pipeline.'
      ],
      visual: RESPONSIVE_VISUAL,
      caption: 'The preview at a tablet width. Feega edits the running app next to your code.'
    }
  ],
  cost: {
    heading: 'What each one costs',
    paragraphs: [
      'Framer has a free plan at $0 with 500 AI credits a month and a Framer domain. A custom domain needs Basic at $10 a month, and Pro is $30 a month, per its pricing page on 21 November 2026. Its agents spend AI credits, so heavy use can run past the monthly allowance.',
      'Feega is free and open source under Apache-2.0, with no credits and no account. You still pay for hosting and for your coding agent, as you do today.'
    ]
  },
  stepsHeading: 'Try Feega on your landing page in five steps',
  steps: OWN_STEPS,
  closing: 'Keep Framer for a site designers own. Keep the repo for a page your product shares.',
  moreQuestions: [
    { q: 'Can Framer export my site as code?', a: 'The pricing and help pages we read do not say so. Its Code Components are custom React components inside a Framer project.' },
    { q: 'Can a coding agent edit a Framer site?', a: 'Framer lists External Agents for Claude Code, Codex and Cursor, connected through MCP or a local CLI setup.' },
    { q: 'Does Feega work with a site made in Framer?', a: 'No. Feega edits the source of an app running from your own folder.' },
    { q: 'Which frameworks does Feega support?', a: 'SvelteKit, React with Vite, Next.js and Vue. Each has limits, listed in the framework pages of the docs.' },
    { q: 'Is Feega a website builder?', a: 'No. It edits pages that already exist in code, and it has no hosting.' }
  ]
};
