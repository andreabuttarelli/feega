import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-12',
  title: 'No false warning for live scenes that render in video',
  items: ['Live scenes that draw their own video frames no longer warn that the exported video will look different.']
} satisfies ChangelogEntry;
