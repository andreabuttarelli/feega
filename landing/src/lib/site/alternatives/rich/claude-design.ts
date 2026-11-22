import { VisualKind, table, type Rich } from '../alternative';
import { BUTTON_DIFF, EDITOR_VISUAL, OWN_STEPS, PROPERTIES_VISUAL } from './shared';

export const CLAUDE_DESIGN: Rich = {
  verdict:
    'Claude Design and Feega solve different problems. Claude Design makes new designs, prototypes and slides from a conversation. Feega changes a product that is already built, by hand, and writes the result into your own files. If you are starting from nothing, start with Claude Design. If the app is live and a button, a heading or a spacing value needs to move, open Feega.',
  snapshotHeading: 'Claude Design and Feega at a glance',
  snapshot: table(
    ['', 'Claude Design', 'Feega'],
    [
      ['Starts from', 'A prompt, a document or a linked repo', 'The project you already run'],
      ['How you change things', 'You describe it in a chat', 'You click an element and set a value'],
      ['Uses an AI model', 'Yes, it is the product', 'No, and no tokens'],
      ['What your repo receives', 'Nothing directly; Claude Code builds the result', 'A diff in your source files'],
      ['Other outputs', 'Prototypes, slides, PDF', 'None; it edits the running app'],
      ['Cost', 'Included in every Claude plan, shares its usage', 'Free, open source (Apache-2.0)'],
      ['Where it runs', 'claude.ai/design, moving into Claude Code', 'VS Code extension, or npx feega']
    ]
  ),
  highlights: [
    {
      heading: 'It reads your repo; it does not write to it',
      paragraphs: [
        'Claude Design can learn your components, either from a linked repository or with /design-sync. That gives its designs a family resemblance to your product. But the design lives in a Claude Design project, and turning it into code is a second step, done by Claude Code.',
        'Feega skips the second step. There is no design copy of your app to keep in sync, because the thing you are editing is the app. Change a value, and the line in the source file changes with it.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Design first', steps: ['Describe the screen', 'Review the generated design', 'Hand it to Claude Code', 'Review the built result'] },
        us: { title: 'Edit in place', steps: ['Open the running app', 'Click the element', 'Set the value', 'Review the diff'] }
      },
      caption: 'Two shapes of the same job. Neutral illustration, not a screenshot of either product.'
    },
    {
      heading: 'A hand edit is a two-second job',
      paragraphs: [
        'Prompting is a good way to get a first draft. It is a slow way to nudge padding from 12 to 14 pixels. You write the request, wait, read what came back, and check that nothing else moved.',
        'In Feega you select the element and type the number. The diff is exactly the line you meant, and nothing else changes, because there is no model deciding what else might need adjusting.'
      ],
      visual: BUTTON_DIFF,
      caption: 'The kind of diff a Feega edit produces: one value, one line.'
    },
    {
      heading: 'No AI in the loop means the same edit gives the same result',
      paragraphs: [
        'Feega has no model, so there are no tokens to spend and no output that varies from run to run. The same click on the same element writes the same line.',
        'That also means Feega has nothing to say about what a design should be. It will not propose a layout. If you want ideas, Claude Design is the better tool, and nothing stops you using both on the same project.'
      ],
      visual: PROPERTIES_VISUAL,
      caption: 'The Feega editor: layers, the live page and the Properties bar.'
    }
  ],
  cost: {
    heading: 'What each one costs you',
    paragraphs: [
      'Claude Design is included in every Claude plan and draws on that plan’s usage, so heavy design sessions share a budget with everything else you do in Claude. If you already pay for Claude, it adds no seat.',
      'Feega is free and open source under Apache-2.0. It has no account, no usage limit and sends nothing, because there is no server behind it. The tradeoff is the one above: it edits, it does not generate.'
    ]
  },
  stepsHeading: 'Try Feega on your own app in five steps',
  steps: OWN_STEPS,
  closing: 'Keep Claude Design for the new thing. Use Feega on the one you shipped.',
  moreQuestions: [
    { q: 'Do I have to choose between them?', a: 'No. Claude Design makes new designs; Feega edits the app that exists. They touch different files at different moments, so they sit side by side.' },
    { q: 'What happens to the standalone Claude Design site?', a: 'According to Anthropic’s pages as we read them, claude.ai/design closes on 14 December 2026 and the product moves into Claude Code.' },
    { q: 'Does Feega need an internet connection or an account?', a: 'No account. It runs your dev server locally and edits local files.' },
    { q: 'Which frameworks does Feega work with?', a: 'SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro and Vite, with plain CSS or Tailwind.' }
  ]
};
