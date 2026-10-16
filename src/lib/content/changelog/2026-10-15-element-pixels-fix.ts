import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Shapes, text and placed results show their real colours',
  items: [
    'A generated image, video or text placed on the canvas shows its own content instead of a black box, closed and while you edit it.',
    'Text you draw or place on the canvas is dark and fully shown, not faded out or white on the light canvas.'
  ]
} satisfies ChangelogEntry;
