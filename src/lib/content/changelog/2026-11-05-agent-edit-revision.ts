import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-05',
  title: 'Agents never overwrite your edits',
  items: ['An outside agent that edits an element you changed after it looked is stopped and rereads the frame; its edits elsewhere still land.']
} satisfies ChangelogEntry;
