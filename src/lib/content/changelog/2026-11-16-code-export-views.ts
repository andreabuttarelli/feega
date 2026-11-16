import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-16',
  title: 'Code export follows every view',
  items: ['Exported code now includes layers that exist only in a phone or tablet view', 'Overrides on layers inside a component now reach the exported code', 'The Code panel exports all views of a frame, whichever view you are editing']
} satisfies ChangelogEntry;
