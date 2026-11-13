import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-13',
  title: 'Large canvases on phones',
  items: ['On a phone, frames too small to read show their thumbnail until you zoom in, so large canvases use far less memory.', 'A canvas that reloads after the page crashed reopens zoomed out instead of in the view it crashed in.']
} satisfies ChangelogEntry;
