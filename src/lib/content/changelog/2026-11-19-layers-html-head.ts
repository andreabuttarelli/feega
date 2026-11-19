import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Layers show the whole page',
  items: [
    'Layers now start at html: a collapsed Head group, then body with your page.',
    'Select html or body from Layers or the breadcrumb to style the whole page.',
    'Selecting a head element shows its attributes.'
  ]
} satisfies ChangelogEntry;
