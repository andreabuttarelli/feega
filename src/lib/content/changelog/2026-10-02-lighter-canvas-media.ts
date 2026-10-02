import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-02',
  title: 'Lighter canvas',
  items: [
    'Images and videos on a canvas load from your browser cache instead of downloading again.',
    'Videos on a canvas download only when you play them.',
    'Calendar nodes refresh every five minutes and when you return to the tab.'
  ]
} satisfies ChangelogEntry;
