import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Every page of a big local canvas fills in sooner',
  items: ['In local mode, every page of a large canvas shows its layout before images start loading, so the last pages no longer wait behind the first ones.']
} satisfies ChangelogEntry;
