import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'Right bar background in the editor',
  items: ['The chat, Guide and Properties bar no longer turns transparent when you open the motion editor.', 'Opening a frame no longer makes the right bar blink out for a moment.', 'The right bar keeps the same width and tabs on the canvas and in the editor; a frame only adds Properties.']
} satisfies ChangelogEntry;
