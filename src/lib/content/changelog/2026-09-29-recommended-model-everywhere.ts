import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Recommended models everywhere',
  items: [
    'Nodes without a chosen model now use the recommended model for text, images and video, in workflows and loops too.',
    'A model you or an agent picks always wins; an unknown model is refused with suggestions.'
  ]
} satisfies ChangelogEntry;
