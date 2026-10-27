import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-27',
  title: 'Smart animate',
  items: [
    'Prototype links can now use Smart animate: layers with the same name in both frames move, resize, turn and change colour from one frame to the other, and the rest fades.',
    'Preview the transition under the link with Play or by dragging the slider.',
    'The agent sets it through add_interaction.'
  ]
} satisfies ChangelogEntry;
