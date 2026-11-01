import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'Imported pages bring their design tokens',
  items: ['A page imported from a URL now brings its colours as variables and its type, shadows and gradients as styles, named Primary, Text, Body, H1 and so on. Change one and every layer that uses it follows.', 'Imported pages now use the fonts of the original site.']
} satisfies ChangelogEntry;
