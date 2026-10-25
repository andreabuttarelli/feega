import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-25',
  title: 'Clearer shots and UI pieces for agents',
  items: [
    'Shots list every slot with its type, default and range, colours included.',
    'Each UI piece lists its own props before you place it.',
    'Corner radius on UI pieces can be changed after placing them.',
    'Short videos are no longer blocked for missing music or a script.'
  ]
} satisfies ChangelogEntry;
