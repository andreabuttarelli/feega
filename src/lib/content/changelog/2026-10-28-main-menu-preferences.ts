import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-28',
  title: 'A tidier main menu',
  items: [
    'The main menu has a Preferences submenu, starting with Rulers and its shortcut.',
    'Theme is now a Light, Dark or System choice with a check on the current one.',
    'Right-click menus stay on screen: they shift to fit, and long ones scroll with arrows at the edges.'
  ]
} satisfies ChangelogEntry;
