import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'Canvas frame fixes',
  items: [
    'A frame whose content ends before the video does now shows that content on the canvas instead of black.',
    'The Publish to gallery preview fits its box and shows the video.',
    'Previewing a batch row from Save as template shows that row in the frame on the canvas.'
  ]
} satisfies ChangelogEntry;
