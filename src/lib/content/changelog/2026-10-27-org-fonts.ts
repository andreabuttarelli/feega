import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-27',
  title: 'Organization fonts',
  items: [
    'Upload a font once and use it across your organization: frame text, code frames and exports.',
    'Settings → Fonts lists, previews and deletes uploaded fonts.',
    'The CLI and MCP can list, upload and delete fonts.',
    'Fonts uploaded in local mode are saved inside the .feega file.'
  ]
} satisfies ChangelogEntry;
