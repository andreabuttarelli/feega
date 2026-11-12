import { APP_URL } from '../links';
import { guidePath } from '../guides';
import type { ChapterCopy, Step } from '../chapters';

export const MOTION: ChapterCopy = {
  eyebrow: 'Layout → Timeline → Video',
  heading: 'Animate any layout',
  lead: 'Key it on a timeline, by hand or with the motion agent. Export an MP4.',
  start: { href: `${APP_URL}/?utm_source=feega.app&utm_medium=site&utm_campaign=motion`, label: 'Start animating' },
  more: { href: guidePath('animate-ui-with-ai-agent'), label: 'See how it works' }
};

export enum MotionGlyph {
  Key = 'key',
  Play = 'play',
  Render = 'render'
}

export const MOTION_STEPS: readonly Step<MotionGlyph>[] = [
  { glyph: MotionGlyph.Key, title: 'Set the keyframes', text: 'Presets, easing, or ask the agent.' },
  { glyph: MotionGlyph.Play, title: 'Play the timeline', text: 'Scrub, loop, refine every key.' },
  { glyph: MotionGlyph.Render, title: 'Render the video', text: 'MP4, GIF or Lottie, with voice-over and music.' }
];
