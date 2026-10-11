import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-11',
  title: 'Smoother shots',
  items: [
    'Title, tagline, zoom and UI shots now move without frame jumps.',
    'Stat shots roll their number up instead of flickering through digits.',
    'The playback check no longer fails a shot over invisible rendering noise.'
  ]
} satisfies ChangelogEntry;
