import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Import a whole project from your editor',
  items: [
    'Importing a folder from Cursor or VS Code now brings in every page of the project, up to 20, not only the home page.',
    'Pages that need a value, like a blog post, are listed as skipped; monorepos ask which app to import.',
    'When it finishes you see how many pages landed and where the canvas file is, with an offer to add it to .gitignore.',
    'npx feega gains --routes and --app.'
  ]
} satisfies ChangelogEntry;
