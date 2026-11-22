import { VisualKind, table, type Rich } from '../alternative';
import { BUTTON_DIFF, EDITOR_VISUAL, OWN_STEPS } from './shared';

export const STITCH: Rich = {
  verdict:
    'Stitch is for designing new screens with a prompt or your voice, then publishing. Feega is for changing screens you have already shipped. If you are exploring a new flow and want something on a canvas in minutes, use Stitch. If the page exists and one thing about it is wrong, a prompt is the long way round.',
  snapshotHeading: 'Stitch and Feega at a glance',
  snapshot: table(
    ['', 'Stitch', 'Feega'],
    [
      ['Starts from', 'A prompt or your voice', 'Your running app'],
      ['What it produces', 'New screens on a canvas', 'Edits to existing files'],
      ['Exports', 'Antigravity or Netlify', 'Nothing; the source is already yours'],
      ['Your repo', 'Stitch Loop opens pull requests, waitlist only', 'Edited directly'],
      ['Design rules file', 'DESIGN.md', 'Your own CSS or Tailwind'],
      ['Uses AI', 'Yes', 'No, no tokens'],
      ['Cost', 'Google’s pages do not state a price', 'Free, Apache-2.0']
    ]
  ),
  highlights: [
    {
      heading: 'Generating versus editing',
      paragraphs: [
        'Stitch streams designs onto a canvas as you talk to it. For a new screen, that is quick and fun, and you get several directions to choose from.',
        'But a generated screen is a new screen. It is not the one your users already know, with the exact spacing, states and copy it has today.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Generate', steps: ['Describe the screen', 'Pick a direction', 'Export', 'Rebuild it in your app'] },
        us: { title: 'Edit', steps: ['Open the screen you ship', 'Click the element', 'Set the value', 'Review the diff'] }
      },
      caption: 'Neutral illustration of the two paths.'
    },
    {
      heading: 'Stitch Loop is a waitlist for now',
      paragraphs: [
        'Stitch Loop, announced on 18 November 2026, connects to your codebase and opens pull requests from metrics. It is on a waitlist, so as of our check you cannot open it today.',
        'Judge tools on what you can open. When it ships, compare it again; this page carries a date for that reason.'
      ],
      visual: EDITOR_VISUAL,
      caption: 'Feega is available now: extension or npx feega.'
    },
    {
      heading: 'Open source, and no prompt in the way',
      paragraphs: [
        'Feega is open source under Apache-2.0, so you can read exactly what it writes and why. It has no model, so no prompt, no tokens and no variation between runs.',
        'The edit you make is the edit you get, as a diff in your own file.'
      ],
      visual: BUTTON_DIFF,
      caption: 'A plain diff in your source.'
    }
  ],
  cost: {
    heading: 'What each one costs',
    paragraphs: [
      'Google’s Stitch pages did not state a price when we checked, so we cannot compare numbers. Read its current terms before you plan around it.',
      'Feega is free. There is nothing to meter, because nothing in it calls a model.'
    ]
  },
  stepsHeading: 'Try Feega on a shipped page in five steps',
  steps: OWN_STEPS,
  closing: 'Keep Stitch for new screens. Edit shipped pages in place.',
  moreQuestions: [
    { q: 'Can Stitch edit my existing app?', a: 'Stitch Loop is meant to, through pull requests, but it is a waitlist as of 18 November 2026.' },
    { q: 'Can I use a DESIGN.md with Feega?', a: 'Feega does not read one. It works on your actual CSS or Tailwind classes.' },
    { q: 'Do they overlap?', a: 'Little. One explores new screens, the other refines existing ones.' },
    { q: 'Which frameworks does Feega support?', a: 'SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro and Vite.' }
  ]
};
