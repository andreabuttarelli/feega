import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Edit colour tokens once, everywhere',
  items: [
    'Click a colour token on a fill to change its colour or swap it for another token; every element using it updates.',
    'The Styles panel now lists your colour tokens next to text styles, ready to edit.'
  ]
} satisfies ChangelogEntry;
