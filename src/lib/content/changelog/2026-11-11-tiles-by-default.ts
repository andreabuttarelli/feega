import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Smooth zoom on heavy canvases',
  items: ['Zooming and panning stay smooth on canvases full of imported pages: the canvas now draws from tiles prepared ahead.']
} satisfies ChangelogEntry;
