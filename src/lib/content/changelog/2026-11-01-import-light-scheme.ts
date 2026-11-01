import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Imported pages keep the site’s light look',
  items: ['Importing a page from a URL always captures it in light mode, unless the site is dark only, so repeated imports look the same.']
} satisfies ChangelogEntry;
