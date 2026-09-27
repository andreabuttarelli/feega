import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Social feed photos and carousels now stick around',
  items: [
    'Photos pulled into a Social feed node are now saved permanently instead of pointing at a link that could expire.',
    'Carousel posts (multiple photos in one post) now show every photo, with a slide indicator, instead of only the first.'
  ]
} satisfies ChangelogEntry;
