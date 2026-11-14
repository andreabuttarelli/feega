import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-14',
  title: 'Edits redraw only what changed',
  items: ['Moving, hiding or restyling one element inside a big frame redraws just that element, so the change shows sooner.']
} satisfies ChangelogEntry;
