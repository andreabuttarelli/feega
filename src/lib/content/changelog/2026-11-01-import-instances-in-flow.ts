import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Imported components land where the page put them',
  items: [
    'Components inside rows and columns no longer shift when something hangs over their edge, in code and URL imports.',
    'Pages with deeply nested components import much faster from code.',
    'Copies of a component that crop the same picture differently keep their own crop.'
  ]
} satisfies ChangelogEntry;
