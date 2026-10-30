import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Revert from History',
  items: ['Revert any change or a whole session from History, whoever made it; edits made after it stay.', 'The AI changes button is gone: its changes are in History, under the AI filter.', 'Revert from the CLI with `feega history <canvasId> --revert <id>`.']
} satisfies ChangelogEntry;
