import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-18',
  title: 'Faster frame building for agents',
  items: ['Agents apply many frame edits in one step and one saved version, and a refused edit now returns a clear error.']
} satisfies ChangelogEntry;
