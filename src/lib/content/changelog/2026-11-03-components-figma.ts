import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Components that hold a whole design',
  items: [
    'Making a component from a stack, frame or group keeps everything inside it',
    'Editing a main changes every instance, on every page, after reload too',
    'Variant and Swap pickers list every variant of the set',
    'Duplicate and Alt-drag copy in place, children included; a copy of a main is a new main',
    'Clicking a layer inside a component in Layers selects it',
    'An instance shows its own size and position in the inspector',
    'Go to main zooms in when the main would be too small to see'
  ]
} satisfies ChangelogEntry;
