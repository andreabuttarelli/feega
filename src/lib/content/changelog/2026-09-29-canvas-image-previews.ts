import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Lighter images on the canvas',
  items: [
    'Canvas images load at the size you see them and sharpen as you zoom in, so large boards no longer crash iPhone Safari.',
    'Downloads and editors still use the original file.'
  ]
} satisfies ChangelogEntry;
