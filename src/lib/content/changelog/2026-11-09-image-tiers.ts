import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-09',
  title: 'Faster frames with images',
  items: ['Images inside frames load at the size the zoom needs, so image-heavy canvases open about twice as light.']
} satisfies ChangelogEntry;
