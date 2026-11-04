import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Components keep their name and size',
  items: [
    'A component made with ⌥⌘K takes the name of the layer it came from, and its main keeps the same size.',
    'Go to main selects the main and centres it without changing your zoom.',
    'Undoing a resize of a component main puts it back exactly, with a single add-variant button.'
  ]
} satisfies ChangelogEntry;
