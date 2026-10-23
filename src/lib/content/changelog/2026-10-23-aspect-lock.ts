import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-23',
  title: 'Aspect ratio lock',
  items: ['Lock an element\'s aspect ratio from the inspector: changing the width then changes the height with it, and resizing by hand keeps the proportions. Hold Ctrl to resize freely.']
} satisfies ChangelogEntry;
