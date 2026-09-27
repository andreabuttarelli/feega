import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Project settings',
  items: [
    'Settings has a Project section: rename the project, link, switch or unlink its brand, and delete it.',
    'Brand settings on a project without a brand now offer to link or create one instead of failing.',
    'API keys and team settings work on projects that have no brand.'
  ]
} satisfies ChangelogEntry;
