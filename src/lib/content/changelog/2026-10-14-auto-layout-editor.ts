import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Auto layout in the editor',
  items: [
    'Press ⇧A on a selection to put it in an auto layout: a row, column or wrapping grid that keeps its spacing when anything changes.',
    'Set direction, alignment, gap, padding and fixed, hug or fill sizing in Properties, or drag gaps and padding right on the canvas.',
    'Drag a clip inside an auto layout to reorder it.'
  ]
} satisfies ChangelogEntry;
