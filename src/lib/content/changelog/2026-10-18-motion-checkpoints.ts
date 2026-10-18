import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-18',
  title: 'Cleaner version history',
  items: ['Version history keeps one version per editing session instead of one per small change; named versions are never merged.']
} satisfies ChangelogEntry;
