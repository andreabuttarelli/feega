import { VisualKind, table, type Rich } from '../alternative';
import { BUTTON_DIFF, EDITOR_VISUAL, OWN_STEPS, TAILWIND_DIFF } from './shared';

export const V0: Rich = {
  verdict:
    'v0 is a good fit if you like working in a chat and you deploy on Vercel: it imports a GitHub repo, works on a branch and opens a pull request when you publish. Feega is for the person who would rather click the thing than describe it, who hosts elsewhere, or who does not want to pay per message. Neither one replaces the other.',
  snapshotHeading: 'v0 and Feega at a glance',
  snapshot: table(
    ['', 'v0', 'Feega'],
    [
      ['How you work', 'A chat', 'Click and set values'],
      ['Existing repo', 'Import from GitHub', 'Open the folder in your editor'],
      ['How changes land', 'A branch and a pull request on publish', 'A diff in your files'],
      ['Hosting', 'Vercel', 'Wherever you host today'],
      ['Usage limits', 'Free allows 7 messages a day', 'None'],
      ['Price', 'Plus is $30 per user a month', 'Free, Apache-2.0'],
      ['Uses AI', 'Yes', 'No']
    ]
  ),
  highlights: [
    {
      heading: 'Prompting a two-second drag',
      paragraphs: [
        'Nudging a margin, swapping a font weight or changing a colour by one step is a small change. Describing it in a chat turns it into a round trip: write, wait, read, verify.',
        'In Feega the same change is a field and a number, and the page moves as you type.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Chat edit', steps: ['Write the request', 'Wait for the reply', 'Read the changes', 'Publish a pull request'] },
        us: { title: 'Direct edit', steps: ['Click the element', 'Set the value', 'See it update', 'Read the diff'] }
      },
      caption: 'Neutral illustration of the two loops.'
    },
    {
      heading: 'Not tied to one host',
      paragraphs: [
        'v0 is built around Vercel, and that is a feature if you are there. If you deploy to your own infrastructure or another platform, you carry an extra dependency for a tool you use to edit the front end.',
        'Feega does not care where the app is hosted. It edits files on your machine and your pipeline does the rest.'
      ],
      visual: EDITOR_VISUAL,
      caption: 'The editor runs on your machine, in your editor.'
    },
    {
      heading: 'Free, with no message count',
      paragraphs: [
        'Counting messages is a real cost of working in a chat. The free plan allows 7 a day, and Plus is $30 per user a month, per v0’s pricing page when we checked.',
        'Feega has nothing to count. It has no AI, so no tokens, and it is open source under Apache-2.0.'
      ],
      visual: TAILWIND_DIFF,
      caption: 'A hand edit costs nothing to make.'
    },
    {
      heading: 'Where v0 is ahead',
      paragraphs: [
        'v0 can build a whole screen from a description, preview it in one click and merge a pull request subject to your repo’s rules. Feega does not generate anything and does not open pull requests.',
        'If your need is new UI from a prompt, v0 is the right shape.'
      ],
      visual: BUTTON_DIFF,
      caption: 'Feega edits; it does not generate.'
    }
  ],
  cost: {
    heading: 'What each one costs',
    paragraphs: [
      'The prices above are the ones v0 published when we checked on the date shown. They may have changed.',
      'Feega is free with no tier to upgrade to. You pay nothing to edit, and you pay your usual host for what you ship.'
    ]
  },
  stepsHeading: 'Try Feega on your app in five steps',
  steps: OWN_STEPS,
  closing: 'Keep v0 for prompting on Vercel. Click what you can see.',
  moreQuestions: [
    { q: 'Can I use both?', a: 'Yes. Both end in your source files. Commit between sessions to keep diffs readable.' },
    { q: 'Does Feega open pull requests?', a: 'No. It writes files and you commit as usual.' },
    { q: 'Do I need Vercel for Feega?', a: 'No. It is independent of where you host.' },
    { q: 'Which frameworks does Feega support?', a: 'SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro and Vite, with CSS or Tailwind.' }
  ]
};
