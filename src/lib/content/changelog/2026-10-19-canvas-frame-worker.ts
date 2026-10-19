import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'Smoother panning on big canvases',
  items: ['Frames load in the background, so panning no longer stutters while they appear.']
} satisfies ChangelogEntry;
