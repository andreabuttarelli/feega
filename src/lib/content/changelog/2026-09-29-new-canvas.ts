import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'More than one canvas per project',
  items: [
    'Create a new canvas from the canvas menu.',
    'Rename a canvas in place.',
    'Delete a canvas; every project keeps at least one.',
    'Open tabs update the canvas list live.'
  ]
} satisfies ChangelogEntry;
