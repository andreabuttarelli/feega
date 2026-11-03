import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Styles behave',
  items: [
    'Delete a style with one click in its editor.',
    'Renaming a style right after creating it no longer leaves a copy behind.',
    'Styles keep their order after a reload.',
    'Fill and stroke share one colour picker, with your colour styles listed first.',
    'Name a style "Brand / Primary" to group it.',
    'A text can carry a text style and a colour style at the same time.',
    'Text styles in any Google font apply to any frame.',
    'Several selected texts show their size in whole pixels.'
  ]
} satisfies ChangelogEntry;
