import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'Sharper Figma imports and tall exports',
  items: [
    'Imported gradients keep their angle, centre and transparent stops.',
    'See-through, underlined and variable-font text keeps its look after import.',
    'Very tall design frames export in full, without missing layers.'
  ]
} satisfies ChangelogEntry;
