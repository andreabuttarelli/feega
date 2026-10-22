import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'Corners, motion paths and view toggles on the canvas',
  items: [
    'Round a rectangle by dragging its corner handles, right on the canvas.',
    'Bend a motion path on the canvas by dragging its handles.',
    "Outline view (⌘Y), pixel grid (⇧') and layout guides (⇧G) now work on canvas frames.",
    'Add and edit layout guides from Properties when nothing in the frame is selected.'
  ]
} satisfies ChangelogEntry;
