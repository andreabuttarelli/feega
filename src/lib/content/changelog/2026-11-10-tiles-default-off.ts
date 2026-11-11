import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-10',
  title: 'Tiled renderer back to preview',
  items: ['The tiled renderer is opt-in again (add ?coreTiles to the canvas URL) while canvases load faster with the classic renderer.']
} satisfies ChangelogEntry;
