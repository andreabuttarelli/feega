import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-27',
  title: 'Figma paste handles full pages',
  items: [
    'Pasting a whole Figma page keeps every text, including tiny text and long paragraphs.',
    'Component instances pasted from Figma keep their own text, colors, hidden layers and swapped icons.',
    'The paste notice is one short line with a Details list, and closes by itself.'
  ]
} satisfies ChangelogEntry;
