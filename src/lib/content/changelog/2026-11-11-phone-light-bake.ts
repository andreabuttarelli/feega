import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Phones keep less of the canvas in memory',
  items: ['On phones, only the part of the canvas you are looking at is kept ready, so large canvases stay open.']
} satisfies ChangelogEntry;
