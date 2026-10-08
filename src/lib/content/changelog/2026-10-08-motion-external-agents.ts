import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-08',
  title: 'Motion videos for external agents',
  items: [
    'AI agents connected over MCP or the feega CLI can now list your motion videos, publish one as a web embed and get the snippet to paste.',
    'Agents can download the self-contained HTML of a video, and pick format, quality and frame rate when they render.',
    'Asking the editor agent from outside returns at once with a run to check, instead of holding the request open.',
    'New CLI commands: `feega motion list` and `feega motion embed`.'
  ]
} satisfies ChangelogEntry;
