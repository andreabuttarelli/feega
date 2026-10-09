import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-09',
  title: 'Attach files and images in the agent chat',
  items: [
    'Attach images and PDF, Word, PowerPoint, Excel, CSV, text, Markdown or HTML files in the canvas and motion editor chats: with the paperclip, by dragging them in or by pasting an image.',
    'The agent reads documents and sees images, and can place an attached image, like a logo, on the canvas or in the video.',
    'Attachments stay on the message after a reload, and external agents can send them with the motion agent too.'
  ]
} satisfies ChangelogEntry;
