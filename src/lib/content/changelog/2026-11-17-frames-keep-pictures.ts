import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Smoother zoom on big canvases',
  items: ['Zooming and panning no longer reload the pages around you, and images already on screen stay sharp instead of flashing to grey while a sharper version loads.']
} satisfies ChangelogEntry;
