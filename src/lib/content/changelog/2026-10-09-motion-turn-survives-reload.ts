import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-09',
  title: 'Agent work survives a reload',
  items: [
    'Reloading the motion editor while the agent works shows its progress, then the finished video.',
    'Long agent turns save their edits before they run out of time.',
    'Stop ends the agent turn, even after a reload.'
  ]
} satisfies ChangelogEntry;
