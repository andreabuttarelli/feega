import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-13',
  title: 'Large canvases on phones',
  items: ['On a phone, frames zoomed out show a snapshot, made once in the background, and only the frames you are looking at are kept in full, so large canvases stay within the phone’s memory.', 'A canvas that reloads after the page crashed reopens zoomed out instead of in the view it crashed in.']
} satisfies ChangelogEntry;
