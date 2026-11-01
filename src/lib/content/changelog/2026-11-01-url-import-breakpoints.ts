import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Imported pages with tablet and phone layouts',
  items: [
    'Import from URL can read the page at tablet and phone width too and add them to the frame as breakpoints (experimental).',
    'A breakpoint can have its own height, so a phone layout longer than the desktop one fits.',
    'Text wrapping can change per breakpoint.'
  ]
} satisfies ChangelogEntry;
