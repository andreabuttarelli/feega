import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-28',
  title: 'Nested instance overrides in exported code',
  items: ['Exported code keeps overrides on instances nested inside other components, as props passed down.']
} satisfies ChangelogEntry;
