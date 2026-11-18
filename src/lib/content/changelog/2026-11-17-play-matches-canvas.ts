import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Play looks like the canvas',
  items: [
    'Every frame has a Play button in its header.',
    'Play draws frames exactly as the canvas does, in every breakpoint view.',
    'Play follows the window width and switches breakpoint views as you resize; pick Desktop, Tablet, Mobile or any view of the frame.'
  ]
} satisfies ChangelogEntry;
