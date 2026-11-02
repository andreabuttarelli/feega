import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Steadier reloads, finer inspector',
  items: [
    'Reloading a canvas no longer flashes an older version of a frame before the current one',
    'X and Y keep decimals, up to two, like Figma',
    'A selected line shows its two end handles; drag one to move that end, Shift snaps to 45°',
    'A transparent fill reads None over a checkerboard',
    'Gradient handles appear only while the gradient is open in the fill editor',
    'With a layer selected, hovering the empty part of its frame highlights the frame',
    'Opening the insert menu over a frame no longer hides part of the frame'
  ]
} satisfies ChangelogEntry;
