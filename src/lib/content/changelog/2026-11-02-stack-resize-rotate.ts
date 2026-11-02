import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Resizing and rotating a Stack',
  items: [
    'Dragging a Stack taller or wider switches that side from Hug to Fixed at the size you drag, and the Stack stays one box',
    'Text inside a Stack re-lays out live while you resize it, instead of stretching',
    'Rotating a Stack turns it as one element around its centre, without cropping its content'
  ]
} satisfies ChangelogEntry;
