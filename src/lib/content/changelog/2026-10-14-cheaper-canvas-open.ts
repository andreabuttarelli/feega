import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Canvases open faster',
  items: ['Reference images load only when you look at them, so opening a canvas does less work.', 'Posters and images you already opened come back without waiting on the server.']
} satisfies ChangelogEntry;
