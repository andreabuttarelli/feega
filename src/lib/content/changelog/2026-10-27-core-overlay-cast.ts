import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-27',
  title: 'Panning stays smooth on busy canvases',
  items: ['Panning a busy canvas stays near 60 fps, even on slower computers.', 'Heavy frames and canvas labels no longer slow each frame down.']
} satisfies ChangelogEntry;
