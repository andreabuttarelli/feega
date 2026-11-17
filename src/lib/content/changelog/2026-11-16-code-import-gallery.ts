import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-16',
  title: 'Code import brings the whole component library',
  items: ['Importing a React app from code now draws every component of its library with all its variants, not only the ones a page uses', 'Components that cannot be drawn on their own are listed with the reason']
} satisfies ChangelogEntry;
