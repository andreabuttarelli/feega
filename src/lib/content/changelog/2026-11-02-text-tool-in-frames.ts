import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Text tool lands where you click',
  items: [
    'Clicking with the text tool over an instance or near a frame edge creates the text inside the frame.',
    'Text created inside a stack joins the stack.',
    'Letters typed right after placing a text go into it, never trigger shortcuts.',
    'Long auto-width text keeps its position instead of jumping to the left edge.',
    'A frame with an image that fails to load still draws and shows your edits.'
  ]
} satisfies ChangelogEntry;
