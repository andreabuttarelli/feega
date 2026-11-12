import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Lighter zoom on big canvases',
  items: ['Zooming a canvas with many nodes does less work on every frame.']
} satisfies ChangelogEntry;
