import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-09',
  title: 'No freeze when pausing a zoom (preview)',
  items: ['With ?coreTiles, pausing mid-zoom no longer freezes the canvas; the sharp picture fills in piece by piece.']
} satisfies ChangelogEntry;
