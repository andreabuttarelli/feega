import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Frames and groups turn, flip and stack',
  items: [
    'Frames rotate from the handle or the Rotate field',
    '⇧H and ⇧V flip whole frames and groups, in one undo',
    'Rotating a group from the right bar turns everything in it around its centre',
    'The frame panel has align, X, Y, rotation, flip and an Auto layout button; ⇧A on a frame gives it auto layout',
    'Dropping a layer on an empty frame in Layers puts it inside'
  ]
} satisfies ChangelogEntry;
