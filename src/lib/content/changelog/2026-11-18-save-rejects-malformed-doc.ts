import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-18',
  title: 'A damaged frame no longer breaks an import or restore',
  items: ['Importing a .feega file or restoring a canvas version with a damaged frame no longer fails the whole request.']
} satisfies ChangelogEntry;
