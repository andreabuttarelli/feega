import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'A cleaner Properties panel',
  items: [
    'Properties fields are rounded chips with their label inside, two per row, all the same height.',
    'Opacity and corner radius have a slider in the same chip, and the eye beside opacity hides the layer.',
    'Fill and stroke rows show a large swatch, the hex, and the opacity or width with the type underneath.',
    'Section actions sit before the collapse arrow; closed sections read muted.'
  ]
} satisfies ChangelogEntry;
