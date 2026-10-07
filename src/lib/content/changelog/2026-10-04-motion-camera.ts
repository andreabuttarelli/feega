import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'A virtual camera for motion videos',
  items: [
    'Motion videos have a camera: give layers depth, then dolly, truck, pan, orbit, crane or dolly-zoom through them with real parallax.',
    'Depth of field blurs what is out of focus; rack focus moves it from one layer to another in one click.',
    '3D models turn with the camera and get real bokeh.',
    'Captions and overlays can stay on screen while the camera moves.',
    'The motion agent can set up camera moves for you.',
    'Pictures now show up in videos rendered on our servers, and 3D models animate there too.'
  ]
} satisfies ChangelogEntry;
