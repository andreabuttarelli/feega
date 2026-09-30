import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-30',
  title: 'A cleaner project and canvas switcher',
  items: [
    'The project and canvas menus are redesigned: recent projects first, the current one highlighted, and the brand shown next to the project.',
    'Find a project by typing when you have more than six.',
    'Rename from the pencil on the current row; delete a canvas from its ⋯ menu.'
  ]
} satisfies ChangelogEntry;
