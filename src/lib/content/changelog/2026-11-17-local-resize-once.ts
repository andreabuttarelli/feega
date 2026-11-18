import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Local canvases with many images open faster',
  items: ['In local mode, each image size is prepared once, so large canvases fill in sooner and reopen faster.']
} satisfies ChangelogEntry;
