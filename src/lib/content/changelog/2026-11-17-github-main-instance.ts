import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Main components and instances in GitHub pushes',
  items: ['Editing a main component changes its file, and the Changes panel says how many pages it affects.', 'Editing an instance changes only that usage, as props; you can apply it to the main component instead.']
} satisfies ChangelogEntry;
