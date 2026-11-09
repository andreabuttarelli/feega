import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-09',
  title: 'Reopening a canvas downloads less',
  items: ['Reopening a canvas reuses the frames your browser already has instead of downloading them again.']
} satisfies ChangelogEntry;
