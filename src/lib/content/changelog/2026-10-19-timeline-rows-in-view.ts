import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'Large frames open faster',
  items: ['Selecting or opening a frame with hundreds of layers no longer waits for every timeline row to draw.']
} satisfies ChangelogEntry;
