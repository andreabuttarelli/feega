import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Imports wait their turn',
  items: ['Importing a website while another import is running now waits and retries, with a "busy" note in the dialog, instead of failing.', 'An import that cannot be saved now says why, instead of adding an empty frame.']
} satisfies ChangelogEntry;
