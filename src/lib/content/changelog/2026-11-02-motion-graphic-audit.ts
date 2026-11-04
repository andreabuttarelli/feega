import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Timeline, poster frame and export',
  items: [
    'Set a video’s duration right in the timeline; the MP4 is exactly that long',
    'Export just the work area, or the whole video',
    'Mark a poster frame: the canvas and image exports show it instead of the first frame',
    'Text shows as drawn from its first frame; its fade-up entrance is now a choice',
    'Text animations start at the clip edge when Clip edge is picked',
    'Make seamless closes the loop on the last frame of your content and says what it did',
    'Shift-click clips, then drag one edge to trim them all',
    'Timeline rows use layer names, and the graph editor labels its axes',
    'A canvas left in Motion reopens in Design'
  ]
} satisfies ChangelogEntry;
