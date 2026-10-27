import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-24',
  title: 'A lighter MCP server',
  items: [
    'The feega MCP server now lists 10 tools instead of 54, so agents spend far fewer tokens per turn.',
    'Agents find and load the other tools on demand with find_tools and load_tools, or run any of them through edit.',
    'A wrong tool call now answers with the exact input it expects.'
  ]
} satisfies ChangelogEntry;
