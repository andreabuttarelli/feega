import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-08',
  title: 'Agents can see your videos',
  items: [
    'The motion agent checks its own frames even when the editor is closed.',
    'External agents can look at any moment of a video with view_motion_frames, or `feega motion frames <id> --at 1,2.5`.'
  ]
} satisfies ChangelogEntry;
