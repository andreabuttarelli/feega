import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Components: steadier homing, Layers drops, real resizing',
  items: [
    'A new component moves to the Components page once, never twice, and edits made meanwhile are kept',
    'Drag a layer onto a main in Layers to put it inside the main',
    'Typing W or H on an instance resizes it like a frame instead of scaling it',
    'The Components panel opens fast on projects with hundreds of components'
  ]
} satisfies ChangelogEntry;
