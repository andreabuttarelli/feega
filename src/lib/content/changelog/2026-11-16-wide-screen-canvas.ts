import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-16',
  title: 'Canvas works on wide screens',
  items: ['The canvas no longer goes blank or flickers on very wide or 4K displays.', 'Replacing an image while zooming no longer crashes the canvas.']
} satisfies ChangelogEntry;
