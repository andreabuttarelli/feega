import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-21',
  title: 'Large frames stay drawn when you zoom in',
  items: ['On the canvas, a large frame you zoom into no longer goes blank once the zoom stops.']
} satisfies ChangelogEntry;
