import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Stricter node updates for agents',
  items: ['Agents updating a node now get a clear error listing valid fields when they send one the node does not have.']
} satisfies ChangelogEntry;
