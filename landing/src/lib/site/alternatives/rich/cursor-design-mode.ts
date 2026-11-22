import { VisualKind, table, type Rich } from '../alternative';
import { BUTTON_DIFF, EDITOR_VISUAL, OWN_STEPS, TAILWIND_DIFF } from './shared';

export const CURSOR_DESIGN_MODE: Rich = {
  verdict:
    'If you live in Cursor and you are happy to hand edits to an agent, Design Mode is hard to beat: you annotate the running app and the agent changes the source with the exact component stack. Feega is for the moment you would rather click an element and set a number than describe it. They are not rivals. Feega installs inside Cursor too.',
  snapshotHeading: 'Cursor Design Mode and Feega at a glance',
  snapshot: table(
    ['', 'Cursor Design Mode', 'Feega'],
    [
      ['How you ask for a change', 'Annotate the running app; an agent edits', 'Click an element and set a value'],
      ['Who makes the edit', 'An AI agent', 'You; Feega writes it to source'],
      ['Tokens', 'Agent usage applies', 'None; no AI'],
      ['Needs', 'Cursor 3.24.18 or later and a running dev server', 'An editor, or npx feega; it starts the dev server for you'],
      ['Editors', 'Cursor', 'VS Code, Cursor, Windsurf, VSCodium'],
      ['Cost', 'Free to start; Plus is $8 a month', 'Free'],
      ['Commits', 'Its page does not say; you commit in Cursor', 'You commit as usual']
    ]
  ),
  highlights: [
    {
      heading: 'Describing versus setting',
      paragraphs: [
        'With an agent, you say what you want and then check what you got. That is the right trade for a change you cannot easily express as a number, like “make this section feel calmer”.',
        'For a change you can express as a number, setting it directly is faster and has no ambiguity. There is no step where the model decides to also touch the line above.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Agent edit', steps: ['Annotate the element', 'Write what you want', 'Wait for the agent', 'Read what it changed'] },
        us: { title: 'Hand edit', steps: ['Click the element', 'Type the value', 'See it update', 'Read the diff'] }
      },
      caption: 'Neutral illustration of the two loops.'
    },
    {
      heading: 'A Properties bar, not a prompt box',
      paragraphs: [
        'Feega gives you layers, a live preview and a Properties bar, the way a design tool does. Spacing, colour, type and layout are fields you change, with the page updating as you type.',
        'It is built for people who think in controls. If that is you, or if the person making the change is a designer who does not want to write prompts, this is the shape that fits.'
      ],
      visual: EDITOR_VISUAL,
      caption: 'The Feega editor: layers, the live page and the Properties bar.'
    },
    {
      heading: 'The same edit, written the same way',
      paragraphs: [
        'An agent can phrase the same change differently on different runs. Feega has no model, so the same click writes the same line, in your CSS or in your Tailwind classes.',
        'That is useful when a team cares about consistent diffs, or simply when you do not want to spend tokens on a margin.'
      ],
      visual: TAILWIND_DIFF,
      caption: 'A Tailwind class change as Feega writes it.'
    },
    {
      heading: 'Use both',
      paragraphs: [
        'Nothing stops you from running Feega inside Cursor and keeping Design Mode for the bigger asks. They both end in your source files, so the review is the same: read the diff.',
        'A reasonable split is hand edits for values, agent edits for structure.'
      ],
      visual: BUTTON_DIFF,
      caption: 'Whichever tool wrote it, the result is a diff.'
    }
  ],
  cost: {
    heading: 'What each one costs',
    paragraphs: [
      'Cursor is free to start and Plus is $8 a month, per its pricing page when we checked. Agent edits draw on that usage.',
      'Feega is free and open source under Apache-2.0, and a hand edit uses nothing.'
    ]
  },
  stepsHeading: 'Try Feega inside Cursor in five steps',
  steps: OWN_STEPS,
  closing: 'Keep Design Mode for agent edits. Click and set values by hand.',
  moreQuestions: [
    { q: 'Does Feega work inside Cursor?', a: 'Yes. Cursor is one of the four editors the extension supports, with VS Code, Windsurf and VSCodium.' },
    { q: 'Does Feega have an agent?', a: 'No. It has no AI. It writes your hand edits to source.' },
    { q: 'Do I need to start my dev server first?', a: 'No. Feega starts it when you open the project. Design Mode needs one already running.' },
    { q: 'Which frameworks work?', a: 'SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro and Vite, with CSS or Tailwind.' }
  ]
};
