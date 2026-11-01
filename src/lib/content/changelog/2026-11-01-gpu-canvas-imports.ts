import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Imported pages draw right on the canvas',
  items: [
    'Variable fonts keep their real letter widths on the canvas at every optical size.',
    'Masks on groups and frames that clip their content look the same on the canvas as in exports.',
    'Pictures inside groups always show on the canvas.',
    'Fonts from sites that protect their font files now come in with the import.'
  ]
} satisfies ChangelogEntry;
