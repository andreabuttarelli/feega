import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'Imported pages look the same on the canvas',
  items: [
    'Fonts that come with an import or an upload now draw on the canvas in every format, including CFF fonts.',
    'Layers inside a frame that clips its content stay inside it on the canvas.',
    'Very tall imported pages no longer show a thin strip at the top.'
  ]
} satisfies ChangelogEntry;
