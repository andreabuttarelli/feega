import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-08',
  title: 'Live agent edits in the motion editor',
  items: [
    'The preview, timeline and inspector show every agent edit as it happens.',
    'A finished agent turn never falls back to the previous video.',
    'The agent keeps seeing its frames for the whole turn.'
  ]
} satisfies ChangelogEntry;
