import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-16',
  title: 'Edits survive a busy server',
  items: ['A node edit that hits a busy server or a simultaneous change is retried until it saves, instead of being dropped.']
} satisfies ChangelogEntry;
