import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Smoother editing by mouse and keyboard',
  items: [
    'Double-clicking a text puts the caret where you clicked instead of selecting everything.',
    'Zoom shortcuts work while the Layers panel has focus.',
    'Picking a brand colour in Selection colours keeps the picker open and focused.',
    'The font picker works from the keyboard: type, arrows, Enter, Esc.',
    'A lone layer in a stack no longer shows reorder buttons it cannot use.'
  ]
} satisfies ChangelogEntry;
