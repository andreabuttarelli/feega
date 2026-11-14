import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-14',
  title: 'Figma paste shows progress and undoes instantly',
  items: ['Pasting from Figma shows a placeholder where the layers will land, with retry if it fails.', 'Undo after a Figma paste removes everything it added at once, and cancels an import still loading.']
} satisfies ChangelogEntry;
