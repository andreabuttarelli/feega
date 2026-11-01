import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'The canvas recovers when the graphics card resets',
  items: ['The canvas uses less graphics memory and keeps working after the graphics card resets, instead of freezing.']
} satisfies ChangelogEntry;
