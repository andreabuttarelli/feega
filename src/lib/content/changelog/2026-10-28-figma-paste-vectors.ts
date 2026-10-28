import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-28',
  title: 'Cleaner Figma pastes',
  items: [
    'Vectors pasted from Figma keep their exact outline, without stray wedges.',
    'Linear gradients pasted from Figma keep their direction.',
    'A Figma frame with no fill pastes see-through instead of on a black stage.'
  ]
} satisfies ChangelogEntry;
