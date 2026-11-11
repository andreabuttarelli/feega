import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Design systems from code',
  items: [
    "Importing from code turns your project's CSS tokens into variables with Light and Dark modes, bound to the layers that use them.",
    'A Design system board shows every colour, radius, spacing and font family, and follows your edits.',
    'Changing a variable writes the token back to your stylesheet, only in the mode you edited.'
  ]
} satisfies ChangelogEntry;
