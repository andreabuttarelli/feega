import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-09',
  title: 'Published embeds stay current',
  items: ['Published embeds now get every playback fix the day it ships, without republishing.', '3D scenes in embeds show their first frame right away; the lighting environment loads after, and is a tenth of the size.']
} satisfies ChangelogEntry;
