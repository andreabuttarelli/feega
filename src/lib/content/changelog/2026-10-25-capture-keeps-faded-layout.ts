import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-25',
  title: 'No layout jumps in browser renders',
  items: ['Elements that fade in no longer make the rest of the frame jump in browser renders, and code components that shift their own layout are flagged when checked.']
} satisfies ChangelogEntry;
