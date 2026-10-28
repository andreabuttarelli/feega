import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-28',
  title: 'Frame selection colours',
  items: [
    'Selecting a frame opens its properties in the right bar.',
    'Frames list every colour they use, most used first, and change one everywhere in a single undoable step.',
    'Selecting several elements shows the properties they share, with Mixed where they differ.'
  ]
} satisfies ChangelogEntry;
