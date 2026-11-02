import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Image layers like rectangles',
  items: [
    'Images in a frame take a corner radius, fills and strokes, in the editor and in exports.',
    'An image placed in a frame is named after its file and pinned left and top.',
    'Image crop and zoom read in percent, and the media picker shows file names.'
  ]
} satisfies ChangelogEntry;
