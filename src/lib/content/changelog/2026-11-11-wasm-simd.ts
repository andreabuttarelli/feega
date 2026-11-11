import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Faster canvas engine',
  items: ['The canvas engine uses your processor’s vector instructions, so it downloads smaller and draws with less work.']
} satisfies ChangelogEntry;
