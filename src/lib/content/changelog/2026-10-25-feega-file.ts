import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-25',
  title: 'Canvases travel as .feega files',
  items: [
    'Download any canvas as a .feega file from the canvas menu, with its frames, nodes and media.',
    'Import a .feega file from the canvas menu, the home page or the sidebar, or drop it on the canvas or the home page: it opens as a new canvas.',
    'Work started on a self-hosted feega moves to feega.app in one file, and the CLI and MCP save and import it too.'
  ]
} satisfies ChangelogEntry;
