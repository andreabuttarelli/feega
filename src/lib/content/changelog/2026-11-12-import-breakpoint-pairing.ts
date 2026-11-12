import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Fewer duplicate layers in imports with breakpoints',
  items: ['Pages imported with tablet and phone layouts keep icons and border lines as one layer across every layout, so the layers panel no longer fills with hidden copies.']
} satisfies ChangelogEntry;
