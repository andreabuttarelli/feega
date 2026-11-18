import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Large local canvases open faster',
  items: ['Saving a large .feega file no longer pauses the canvas while it loads, so every frame of a big canvas appears seconds sooner.']
} satisfies ChangelogEntry;
