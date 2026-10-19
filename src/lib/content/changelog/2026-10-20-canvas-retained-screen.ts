import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'Smoother pan and zoom on the new canvas',
  items: ['Panning and zooming the canvas moves what is already drawn instead of redrawing everything.']
} satisfies ChangelogEntry;
