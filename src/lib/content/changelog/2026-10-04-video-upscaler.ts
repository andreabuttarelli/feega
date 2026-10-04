import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'AI Video Upscaler',
  items: [
    'New AI Video Upscaler tool: upload an MP4 or pick a project video and upscale it to 2× or 4K, with the price shown before you start.',
    'Compare before and after with a slider, then download the result. It is saved to your project assets and marked as AI-generated.',
    'On the canvas, a video node with FLUX Video Upscale now upscales the clip connected to it, and a new Video upscaler template sets it up.',
    'Uploaded images and videos now feed the nodes they are connected to.'
  ]
} satisfies ChangelogEntry;
