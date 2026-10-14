import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Fill layers edit in their own popover',
  items: [
    'Clicking a fill opens its settings in a popover beside Properties, named for that layer; the row stays highlighted.',
    'Collapsed fill rows show the colour or type, opacity, visibility and remove, nothing else.',
    'Escape, a click outside or the close button shut it; on a phone it opens as a bottom sheet.'
  ]
} satisfies ChangelogEntry;
