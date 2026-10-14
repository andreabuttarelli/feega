import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Smoother frame opening on phones',
  items: [
    'A frame keeps its picture while the editor opens, with no black flash.',
    'On a phone a tap selects and moves a frame; Open editor opens it.',
    'Other nodes stay visible while you edit a frame.',
    'An open frame shows only its picture, with no bar under it.'
  ]
} satisfies ChangelogEntry;
