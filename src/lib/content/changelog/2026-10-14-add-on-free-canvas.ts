import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'New nodes never land on top of others',
  items: ['Nodes and frames added from the bottom bar take the nearest free spot instead of stacking on what is already there.']
} satisfies ChangelogEntry;
