import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Smoother panning across crowded canvases',
  items: ['Panning across many cards no longer reworks every frame each time a card reaches the edge of the screen.']
} satisfies ChangelogEntry;
