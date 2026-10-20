import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'Frames no longer vanish while you edit them',
  items: ['On the new canvas, a frame stays visible while you zoom and select inside it, even when the live editor is slow to appear.']
} satisfies ChangelogEntry;
