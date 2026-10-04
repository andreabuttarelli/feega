import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Timeline markers and work area',
  items: [
    'Add labelled markers (M) that clips snap to; the agent can place clips on a marker by name.',
    'Set a work area with B and N; playback loops inside it.',
    'Hide, lock, solo and shy tracks, and search layers by name.',
    'Nudge, sequence, stagger, align and distribute selected clips in time.'
  ]
} satisfies ChangelogEntry;
