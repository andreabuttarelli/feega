import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'Your own fonts',
  items: [
    'Upload TTF, OTF, WOFF or WOFF2 fonts from the font menu, or drop them on the editor or the canvas.',
    'Uploaded fonts are shared with your whole workspace, grouped by family with their weights and italics, and can be renamed or deleted.',
    'Exports, renders and previews use your fonts; a deleted font shows a warning and a fallback instead of breaking the video.',
    'Agents can list and use your uploaded fonts.'
  ]
} satisfies ChangelogEntry;
