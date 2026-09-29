import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'More than one canvas per project',
  items: [
    'Create a new canvas from the canvas menu.',
    'Rename a canvas in place.',
    'Delete a canvas; every project keeps at least one. Nothing on it is lost.',
    'Rename a project from the same menu, on desktop and mobile.',
    'Open tabs update the canvas list live.'
  ]
} satisfies ChangelogEntry;
