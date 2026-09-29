import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Editing never waits for the network',
  items: [
    'Typing, stepping through a Select and changing properties stay instant on large canvases.',
    'Changes save in the background; a small status shows Saved, Saving or Offline.',
    'Nothing you type is lost or reverted while it saves.'
  ]
} satisfies ChangelogEntry;
