import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-16',
  title: 'Text on the canvas',
  items: [
    'Text drawn on the canvas fills the box you drag and is ready to type into.',
    'Edits to a text show on the canvas right away, also after a reload.',
    'Text on a dark canvas starts in light ink.',
    'Text properties include a fixed or auto box width.'
  ]
} satisfies ChangelogEntry;
