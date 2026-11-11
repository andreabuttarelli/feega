import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-09',
  title: 'Canvas shapes and text appear before images',
  items: ['When a canvas opens, every visible frame shows its shapes and text first; images download meanwhile and appear right after.']
} satisfies ChangelogEntry;
