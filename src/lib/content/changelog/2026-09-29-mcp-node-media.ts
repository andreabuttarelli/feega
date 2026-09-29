import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Agents can see the media they generate',
  items: [
    'Agents connected over MCP can now view the images and videos in your canvas nodes, with a preview link and a full-size link.',
    'A finished generation now tells the agent which file it produced, so it can check the result right away.'
  ]
} satisfies ChangelogEntry;
