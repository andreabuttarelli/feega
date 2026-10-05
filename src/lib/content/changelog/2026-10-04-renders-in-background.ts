import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Server renders run in the background',
  items: [
    'Server renders no longer stop at five minutes: long videos and motion blur at 60 fps now finish.',
    'A failed render piece is retried on a fresh machine before the render gives up.',
    'You can cancel a server render from the export dialog; nothing is charged.',
    'The export dialog shows the largest file your storage accepts, and a file over it fails with its real size.'
  ]
} satisfies ChangelogEntry;
