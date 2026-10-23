import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'One canvas renderer',
  items: ['The canvas always draws on the GPU, and shared canvases open on the same renderer.']
} satisfies ChangelogEntry;
