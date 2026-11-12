import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Smoother zoom on big canvases',
  items: ['Zooming out and back in on a large canvas shows ready tiles instead of redrawing them.']
} satisfies ChangelogEntry;
