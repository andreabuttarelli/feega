import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-10',
  title: 'Smoother, faster video exports',
  items: ['Animated UIs no longer flicker between sizes in exported videos.', 'Zoom transitions out of a scene play through instead of popping.', 'Exporting a video in the browser is about four times faster.']
} satisfies ChangelogEntry;
