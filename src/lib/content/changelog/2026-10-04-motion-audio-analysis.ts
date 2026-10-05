import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Motion editor: audio analysis',
  items: [
    'Music and voice-over are analysed for tempo, beats, hits and speech when you use them.',
    'Ducking now drops the music only while the voice is speaking.',
    'Waveforms on the timeline load instantly from the analysis.'
  ]
} satisfies ChangelogEntry;
