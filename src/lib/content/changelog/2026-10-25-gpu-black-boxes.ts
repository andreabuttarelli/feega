import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-25',
  title: 'Canvas drawing fixes',
  items: ['New shapes and text no longer flash black while drawing or typing.', 'Text with symbols like ✓ and → now draws, so every component variant shows.', 'Large embedded images now draw and can be cropped.']
} satisfies ChangelogEntry;
