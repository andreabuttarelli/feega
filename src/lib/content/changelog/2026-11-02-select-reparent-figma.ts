import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Selecting and nesting work like Figma',
  items: [
    'Drag an element onto a stack to insert it where the line shows; reordered items follow the cursor.',
    'Drop a layer on the middle of a stack or frame row to put it inside.',
    'With a stack selected, click a child to select it; ⇧↵ selects the parent.',
    'Shift-click adds the whole stack, and empty stacks no longer catch clicks.',
    'Double-clicking a rectangle no longer turns it into a path until you move a point.',
    'R and O pick the rectangle and ellipse, and the first drag always draws.',
    'Making a component from a stack item keeps it in the stack.'
  ]
} satisfies ChangelogEntry;
