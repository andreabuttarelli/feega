import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'No stray canvas pieces while panning',
  items: ['Panning and zooming no longer briefly shows pieces of other parts of the canvas next to the frames you are looking at.']
} satisfies ChangelogEntry;
