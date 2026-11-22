import { VisualKind, table, type Rich } from '../alternative';
import { BUTTON_DIFF, EDITOR_VISUAL, OWN_STEPS, PROPERTIES_VISUAL } from './shared';

export const ONLOOK: Rich = {
  verdict:
    'Onlook is the closest tool to Feega, and it is good. Both are free and open source under Apache-2.0, and both edit your real code. The difference is where each lives. Onlook is a Mac app that also opens pull requests. Feega is an extension inside the editor you already use, on any operating system. If you work alone on a Mac and want one-press pull requests, Onlook fits. If you want it inside VS Code, Cursor, Windsurf or VSCodium, Feega does.',
  snapshotHeading: 'Onlook and Feega at a glance',
  snapshot: table(
    ['', 'Onlook', 'Feega'],
    [
      ['Where it runs', 'A Mac app', 'VS Code, Cursor, Windsurf, VSCodium, or npx feega'],
      ['Operating systems', 'macOS', 'Any'],
      ['Licence', 'Apache-2.0', 'Apache-2.0'],
      ['Opens your repo', 'Yes, a local folder or GitHub', 'Yes, the folder your editor has open'],
      ['Pull requests', 'One press', 'No; you commit as usual'],
      ['Cost', 'Free self-hosted; hosted via a demo', 'Free'],
      ['Shared editing', 'Check Onlook’s pages for the current state', 'Not yet']
    ]
  ),
  highlights: [
    {
      heading: 'The difference is where it lives',
      paragraphs: [
        'Onlook runs your dev server for you inside its own app. That is a clean experience, and it means your editor and your visual tool are two windows, possibly two views of the same folder.',
        'Feega sits inside the editor. The tool and the code are in one window, so the file you are changing is one tab away.'
      ],
      visual: PROPERTIES_VISUAL,
      caption: 'Feega as a panel in your editor, with the Properties bar for the selected element.'
    },
    {
      heading: 'Pull requests are Onlook’s strength',
      paragraphs: [
        'Onlook can open a pull request in one press. If your team’s workflow is branch, review, merge, that closes the loop faster than a manual commit, and Feega does not do it.',
        'What Feega does is stop one step earlier and keep the edit visible. Each change is a diff in Changes, which you keep or undo, and then you use your usual git tools.'
      ],
      visual: BUTTON_DIFF,
      caption: 'What Feega hands you: a plain diff in your files.'
    },
    {
      heading: 'Any OS, any of four editors',
      paragraphs: [
        'A Mac-only tool is a hard stop for a team with Windows or Linux machines. Feega is an extension, so it runs wherever the editor does.',
        'There is also an npx feega route for people who do not use any of those editors: run it in the project folder and it opens in the browser.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Desktop app', steps: ['Open the app', 'Open the folder', 'Edit', 'Press for a pull request'] },
        us: { title: 'Inside the editor', steps: ['Open the folder in your editor', 'Edit', 'Read the diff', 'Commit with your own tools'] }
      },
      caption: 'Neutral illustration of the two workflows.'
    }
  ],
  cost: {
    heading: 'What each one costs',
    paragraphs: [
      'Both can be used for free. Onlook’s self-hosted version is free on GitHub, and its hosted version is sold through a demo. Feega has no paid tier to compare against.',
      'Choosing on licence will not help, since both are Apache-2.0. Choose on where you work and how you ship.'
    ]
  },
  stepsHeading: 'Try Feega on your project in five steps',
  steps: OWN_STEPS,
  closing: 'Same spirit, different home. Pick the one that sits where you work.',
  moreQuestions: [
    { q: 'Which one is more mature?', a: 'We make Feega, so we are not the right judge. Look at both repositories’ activity and try each on your project.' },
    { q: 'Can I use both on one project?', a: 'Both edit source files, so they can coexist. Commit between sessions to keep diffs easy to read.' },
    { q: 'Does Feega support Storybook or shadcn/ui?', a: 'Onlook lists support for both. Feega works on your running app with SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro or Vite; we make no claim about Storybook.' },
    { q: 'Does Feega need an account?', a: 'No. It sends nothing and runs locally.' }
  ]
};
