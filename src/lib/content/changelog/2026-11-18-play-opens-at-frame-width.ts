import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-18',
  title: 'Play opens on what the canvas shows',
  items: ['Play opens a frame at its own width, with the same layout, line breaks and fonts as the canvas; Follow window reflows it to the window only when you pick it.', 'Images in Play are sharp: Play loads the original files instead of the canvas preview size.']
} satisfies ChangelogEntry;
