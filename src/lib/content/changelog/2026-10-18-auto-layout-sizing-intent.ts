import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-18',
  title: 'Auto layout sizing up front',
  items: ['Fill and hug can be set before a layer joins an auto layout, a new auto layout takes each layer with its sizing in one step, and it lines its content up at the start.']
} satisfies ChangelogEntry;
