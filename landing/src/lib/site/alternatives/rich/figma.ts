import { VisualKind, table, type Rich } from '../alternative';
import { BUTTON_DIFF, EDITOR_VISUAL, OWN_STEPS, PROPERTIES_VISUAL } from './shared';

export const FIGMA: Rich = {
  verdict:
    'Figma is still the right place to design new product UI with a shared library and a handoff. Feega is for the other half of the year: the product has shipped, design and code have drifted, and you want to change the real page instead of redrawing it. If you only have one budget of attention, spend it where the work is. New screens go to Figma. Edits to what is live go to Feega.',
  snapshotHeading: 'Figma and Feega at a glance',
  snapshot: table(
    ['', 'Figma', 'Feega'],
    [
      ['Starts from', 'A blank frame or a shared library', 'The project you already run'],
      ['What you edit', 'A design file', 'The real page, with your own components'],
      ['How it reaches code', 'Handoff, then a developer rebuilds it', 'It is already in the source file'],
      ['Code access', 'Dev Mode reads code through MCP; Make local is a closed beta on the Mac app', 'Edits your repo directly'],
      ['Team collaboration', 'Strong, built in', 'Not yet; no shared editing'],
      ['Cost', 'Paid plans per seat', 'Free, Apache-2.0'],
      ['Uses AI', 'Optional features', 'No, no tokens']
    ]
  ),
  highlights: [
    {
      heading: 'The drift problem',
      paragraphs: [
        'Every team that designs in Figma and builds in code ends up with two versions of the truth. The file says one thing, the page says another, and nobody remembers which change happened first.',
        'Feega removes one of the two copies from the equation for the work you do on shipped pages. You edit the running app, so the source file is the only version there is.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Design file first', steps: ['Redraw the live page', 'Change it in the file', 'Write a spec', 'A developer rebuilds it'] },
        us: { title: 'Edit the page', steps: ['Open the live page', 'Click what needs to change', 'Set the value', 'Review the diff'] }
      },
      caption: 'Neutral illustration of the two paths, not a screenshot of Figma.'
    },
    {
      heading: 'Your components, not a lookalike',
      paragraphs: [
        'A design system in Figma is a picture of components. A design system in your repo is the components themselves, with their real props, real states and real CSS. Feega works on the second one.',
        'Click a button in the running page and you are changing the actual element, whatever it is built from. That matters when a tweak must respect the system rather than approximate it.'
      ],
      visual: EDITOR_VISUAL,
      caption: 'Layers, live preview and Properties inside the editor you already use.'
    },
    {
      heading: 'Every change is a diff you can read',
      paragraphs: [
        'A reviewer cannot comment on a pixel move in a design file the way they can on a line of code. In Feega, each edit shows up in Changes as a diff against your source, which you keep or undo before anything is committed.',
        'That makes it easy to bring a designer into a code review without asking them to learn git. They make the edit; the developer reads the diff.'
      ],
      visual: BUTTON_DIFF,
      caption: 'One edit, one diff.'
    },
    {
      heading: 'Figma is moving toward code too',
      paragraphs: [
        'Make can open a local folder or a GitHub clone, but per Figma’s help page as we read it, only in a closed beta on the Mac desktop app. Dev Mode reads code through its MCP server and does not edit your repo.',
        'If that beta reaches your team and fits how you work, it is worth a look. Today, Feega is the one you can install in a minute on any operating system.'
      ],
      visual: PROPERTIES_VISUAL,
      caption: 'The Properties bar for a selected element. Feega runs on any OS, in VS Code, Cursor, Windsurf or VSCodium.'
    }
  ],
  cost: {
    heading: 'What each one costs',
    paragraphs: [
      'Figma charges per seat on its paid plans, and for a team the cost scales with the number of designers and developers who need access to the library. Check its pricing page for the current numbers.',
      'Feega is free, with no seat, no account and no limit. The honest cost is the missing feature: there is no shared editing yet, so two people cannot work in the same session.'
    ]
  },
  stepsHeading: 'Try Feega on a shipped page in five steps',
  steps: OWN_STEPS,
  closing: 'Keep Figma for new UI. Stop rebuilding what already shipped.',
  moreQuestions: [
    { q: 'Should we stop using Figma?', a: 'No. If you design new screens and share a library, keep doing it there. Feega covers the edits to what has already shipped.' },
    { q: 'Is Figma Make the same thing as Feega?', a: 'Not today. Make local, as of our check, is a closed beta on the Mac desktop app. Feega is available now and is not tied to a generative model.' },
    { q: 'Can a designer use Feega without learning git?', a: 'They click and set values, and see each change as a diff. A developer can review and commit.' },
    { q: 'Which stacks does Feega support?', a: 'SvelteKit, React, Next.js, Vue, Nuxt, React Router, Astro and Vite, with CSS or Tailwind.' }
  ]
};
