import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-16',
  title: 'Keep editing offline',
  items: [
    'Canvas edits made offline, or before a reload or a closed tab, are kept and saved when you are back.',
    'A small dot replaces the save label: hidden when everything is saved, amber while offline.',
    'Generating is paused while offline, with a note saying why.'
  ]
} satisfies ChangelogEntry;
