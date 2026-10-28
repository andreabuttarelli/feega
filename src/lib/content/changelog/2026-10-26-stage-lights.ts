import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-26',
  title: 'Lights',
  items: [
    'Add ambient, point, spot and parallel lights to a video with a camera; flat layers catch light by their tilt.',
    'Light colour, intensity, falloff and cone are keyframable; a layer can opt out with Accepts lights.',
    'The motion agent can add and animate lights.'
  ]
} satisfies ChangelogEntry;
