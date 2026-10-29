import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Conflicts in History',
  items: ['When two people or agents change the same node or frame at once, the refused change now shows in red in History, with Keep mine or Keep theirs.', 'Resolve a conflict with `feega resolve-conflict` or the MCP `resolve_conflict` op.']
} satisfies ChangelogEntry;
