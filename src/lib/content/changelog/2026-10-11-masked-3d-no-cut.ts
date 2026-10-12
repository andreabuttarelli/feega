import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-11',
  title: 'Masked 3D objects keep their shape',
  items: ['A masked 3D object reaching past the frame edge is no longer cut by a straight line.']
} satisfies ChangelogEntry;
