import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Fixed a broken link into the app',
  items: ['Opening the app now always lands you on your canvas — a stale link could show a not-found page.']
} satisfies ChangelogEntry;
