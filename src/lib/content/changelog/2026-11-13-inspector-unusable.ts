import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-13',
  title: 'Inspector fixes',
  items: [
    'Effect colours can be typed and picked, by mouse and keyboard.',
    'Undoing a frame resize from the inspector restores the frame size.',
    'A stack item’s fixed width can be nudged with the arrow keys.',
    'Menus stay inside small windows.',
    'Small inspector buttons and sliders are easier to hit.'
  ]
} satisfies ChangelogEntry;
