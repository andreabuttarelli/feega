import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Move elements between frames',
  items: [
    'Drag an element out of an open frame onto another frame to move it there, keeping its style and animation.',
    'Drop it on the empty canvas to get a new frame holding just that element.',
    'Drag a generated image, video or text into a frame from the handle on its corner.',
    'Connect an image, video or text node to a frame: its result appears inside and follows each new generation.'
  ]
} satisfies ChangelogEntry;
