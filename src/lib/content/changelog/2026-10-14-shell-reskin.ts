import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'A clearer editor, in light and dark',
  items: [
    'Bars, panels and the canvas now sit on distinct greys, so each area reads apart at a glance.',
    'Tooltips show each tool’s keyboard shortcut.',
    'Menus, layers and toolbars have clearer hover, selected and focus states.',
    'Layers can be searched, and switch to Assets with one click.',
    'The canvas shows its zoom level, and the canvas name sits in the middle of the top bar.'
  ]
} satisfies ChangelogEntry;
