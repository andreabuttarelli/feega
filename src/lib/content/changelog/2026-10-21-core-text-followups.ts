import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-21',
  title: 'Cleaner text on the new canvas',
  items: ['No more faint double text behind a frame you are editing.', 'The caret moves when you type spaces at the end of a text.', 'A text that grows taller than its frame no longer blocks further edits.']
} satisfies ChangelogEntry;
