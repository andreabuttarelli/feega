import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-09',
  title: 'Faster canvas opening',
  items: ['Canvases with many frames load their content in one request instead of one per frame.']
} satisfies ChangelogEntry;
