import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-16',
  title: 'API keys follow your role',
  items: ['An API key now has the access its owner has today: demoted to viewer, it can only read; removed from the organization, it stops working.']
} satisfies ChangelogEntry;
