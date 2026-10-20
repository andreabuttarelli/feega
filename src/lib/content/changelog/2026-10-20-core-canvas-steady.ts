import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'A steadier new canvas renderer',
  items: ['Cards keep showing their last picture while a new version loads, instead of flashing empty.', 'Zooming out on a large canvas stays smoother.', 'A rendering error on the new canvas now falls back to the classic one instead of leaving the canvas blank.']
} satisfies ChangelogEntry;
