import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'Nodes stay drawn while they refresh',
  items: ['On the new canvas, a node you have seen stays on screen exactly as it was until its new version is ready, instead of flashing a grey or black box when you zoom.']
} satisfies ChangelogEntry;
