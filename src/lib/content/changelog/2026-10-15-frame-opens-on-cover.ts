import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Frames no longer turn black when you open them',
  items: ['Opening a frame on the canvas shows its content right away, starting from the middle of the video instead of an empty first frame.']
} satisfies ChangelogEntry;
