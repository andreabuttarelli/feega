import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Import from code starts more apps',
  items: [
    'Import from code now starts Nuxt, Astro, Angular, Gatsby, React Router and Create React App apps, with the package manager version and Node version the repository asks for.',
    'In a monorepo, pick the app to import; a link to an app folder or a branch with a slash in its name works too.'
  ]
} satisfies ChangelogEntry;
