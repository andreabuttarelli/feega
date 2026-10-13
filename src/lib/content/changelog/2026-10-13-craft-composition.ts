import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-13',
  title: 'Compositions crafted from a reference',
  items: [
    'Give the motion chat a reference picture and it builds a new composition from scratch, looking at its own frames next to the reference and fixing them over several rounds.',
    'Each round shows up in the chat as a contact sheet, and the result can be saved to your team templates with its editable fields.'
  ]
} satisfies ChangelogEntry;
