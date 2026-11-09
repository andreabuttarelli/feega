import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-09',
  title: 'Fewer tile reloads on big canvases (preview)',
  items: ['With ?coreTiles, large canvases keep more of what you have seen, so panning back no longer reloads it.']
} satisfies ChangelogEntry;
