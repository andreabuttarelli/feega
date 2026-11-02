import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Resize and rotate several shapes at once',
  items: [
    'Selecting several shapes shows one box: drag its handles to resize or rotate them together, and one undo puts them back.',
    'Properties stays open for a multi-selection, with X, Y, W, H and rotation, Mixed where they differ.',
    'Resizing a main inside a component set now previews only that main, with its variants moving aside; agents can resize it too.',
    'Soft drop shadows no longer show a light edge around a shape after it is selected.'
  ]
} satisfies ChangelogEntry;
