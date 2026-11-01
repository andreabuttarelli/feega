import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'More of an imported page stays editable',
  items: [
    'Dashed and dotted borders and lines come in as dashed strokes, from URL and Figma imports.',
    'Blended pictures and blocks keep their blend mode as a layer setting.',
    'Blocks that fade out at an edge come in with editable gradient masks instead of a picture.',
    'Lists in auto layout no longer open gaps after long items.'
  ]
} satisfies ChangelogEntry;
