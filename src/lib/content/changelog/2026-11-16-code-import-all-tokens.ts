import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-16',
  title: 'Code import brings in the whole design system',
  items: [
    'Importing a repo now reads Tailwind 3 config themes and SCSS or LESS variables',
    'Big themes import whole: up to 512 variables per collection and 200 styles',
    'Editing a variable writes back to the Tailwind config or Sass file it came from',
    'Imported variables and styles are added to the project library',
    'Tokens that cannot be imported are listed with the reason'
  ]
} satisfies ChangelogEntry;
