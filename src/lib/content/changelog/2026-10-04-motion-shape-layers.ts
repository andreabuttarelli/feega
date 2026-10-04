import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Vector shapes in the motion editor',
  items: [
    'Shapes now include ellipses, polygons, stars and free paths you draw with the pen tool.',
    'Shapes take gradient fills and strokes with dashes, caps and joins.',
    'Morph one shape into another, through as many shapes as you like.',
    'Stack modifiers on a shape: trim paths, repeater, offset, wiggle, zig zag, round corners and merge.',
    'Stars, polygons and paths work as track mattes.'
  ]
} satisfies ChangelogEntry;
