import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-23',
  title: 'Shared variables',
  items: ['Variables are shared across the frames of a canvas: edit one in a frame and every frame that uses it follows, while each frame keeps its own light or dark mode.']
} satisfies ChangelogEntry;
