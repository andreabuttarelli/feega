import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-11',
  title: 'Finished videos no longer time out on the canvas',
  items: ['A video that finished rendering now always lands on its node instead of timing out after 20 minutes.']
} satisfies ChangelogEntry;
