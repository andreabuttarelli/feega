import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Frames never go blank over one bad layer',
  items: ['A frame with a layer carrying an unknown or broken setting now draws, ignoring only that setting.']
} satisfies ChangelogEntry;
