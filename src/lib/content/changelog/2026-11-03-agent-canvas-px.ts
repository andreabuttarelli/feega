import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Canvas pixels everywhere',
  items: [
    'The motion agent and MCP tools read and write frames in the pixels you see on the canvas.',
    'Timeline value fields show the same numbers as the inspector.',
    'Text styles draw at their pixel size in older frames too.'
  ]
} satisfies ChangelogEntry;
