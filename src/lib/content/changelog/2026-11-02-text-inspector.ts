import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Text properties in a clearer order',
  items: [
    'Text properties read alignment, position, size, appearance, typography, then fill, stroke and effects.',
    'Line height and letter spacing show as percentages of the font size.',
    'The aspect-ratio lock sits at the end of the width and height row.',
    'Dropdowns in Properties use a matching chevron.'
  ]
} satisfies ChangelogEntry;
