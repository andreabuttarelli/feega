import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Tablet and phone layouts that match the page',
  items: [
    'Imported tablet and phone layouts now look like the page at that width: other headlines, pictures and menus included.',
    'A phone layout longer than the desktop page fits its view whole.',
    'Components and interactive parts are kept when you import with breakpoints.',
    'Letter spacing, font axes and a shape’s outline can change per breakpoint.'
  ]
} satisfies ChangelogEntry;
