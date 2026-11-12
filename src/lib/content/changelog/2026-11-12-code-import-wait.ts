import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Code import waits for late content',
  items: ['Code import now waits for a page to stop changing before capturing it, so content that appears a moment after load is no longer missing.', 'New extra wait before capture, for the whole import or per page, in the import dialog and the CLI.']
} satisfies ChangelogEntry;
