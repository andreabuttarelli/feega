import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-10',
  title: 'Tighter titles in vertical videos',
  items: ['Stacked title lines stay tight in vertical videos.', 'Type running past the frame edge is a note, no longer a reason to rework the video.', 'The video check now catches transitions that never play and black frames at the end.']
} satisfies ChangelogEntry;
