import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-17',
  title: 'No more edit clashes',
  items: ['Two people changing the same node no longer get a “reload” warning: the latest change wins, and different settings never overwrite each other.']
} satisfies ChangelogEntry;
