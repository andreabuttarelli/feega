import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Faster edits in an open frame',
  items: ['Editing text or a property in a frame on the canvas updates only what changed: the preview no longer reloads and the canvas no longer resyncs after each save.']
} satisfies ChangelogEntry;
