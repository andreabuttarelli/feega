import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-16',
  title: 'A quieter canvas',
  items: ['The canvas no longer keeps redrawing while it waits after an edit, so editing feels lighter and uses less battery.']
} satisfies ChangelogEntry;
