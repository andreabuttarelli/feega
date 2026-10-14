import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Quieter canvas after reconnecting',
  items: ['The canvas no longer shows a banner when it refreshes after reconnecting: the connection dot already tells you.']
} satisfies ChangelogEntry;
