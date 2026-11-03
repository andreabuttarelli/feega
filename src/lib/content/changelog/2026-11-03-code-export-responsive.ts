import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Responsive code export',
  items: [
    'Exported code now reflows: layers stacked in a frame become a column, and wide layers stretch up to their design width.',
    'Images ship inside the downloaded project instead of links that expire.'
  ]
} satisfies ChangelogEntry;
