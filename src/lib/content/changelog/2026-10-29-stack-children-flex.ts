import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Stack children behave like flex items',
  items: [
    'Size a Stack child in px, %, Fill with a weight (2fr) or Hug: pick the unit or type it.',
    'Stack children get Align self and an Absolute position toggle; X and Y show only when absolute.',
    'Drag a Stack child to reorder it, move it to another Stack or take it out; arrow keys reorder it.'
  ]
} satisfies ChangelogEntry;
