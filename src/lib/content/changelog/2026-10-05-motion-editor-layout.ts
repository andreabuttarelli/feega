import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-05',
  title: 'A roomier motion editor',
  items: [
    'The timeline now spans the full width under the preview and properties.',
    'Play, frame stepping and the timecode sit in the centre of the top bar.',
    'Format, length, frame rate, background and motion blur live in one composition chip.',
    'The timecode reads minutes:seconds:frames; click it to count frames instead.'
  ]
} satisfies ChangelogEntry;
