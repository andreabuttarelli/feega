import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'Frames never disappear while you edit them',
  items: ['On the new canvas, the frame you are editing is always drawn by the canvas itself, so it no longer vanishes or shows twice when you zoom.']
} satisfies ChangelogEntry;
