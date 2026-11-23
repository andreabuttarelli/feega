import { freeAnswer } from './pricing/plan';
import { GITHUB_URL } from './links';

const VIDEO_BASE = 'https://klnswzhhgrqvbfjzioul.supabase.co/storage/v1/object/public/website';

export const HERO_HEADLINE = 'Design in your codebase';

export const CANVAS_VIDEO = `${VIDEO_BASE}/feega-canvas-hero.MP4`;

export const AGENT_LOGOS = [
  { file: 'mcp-0.svg', width: 32, name: 'Claude Code' },
  { file: 'mcp-1.svg', width: 33, name: 'Codex' },
  { file: 'mcp-2.svg', width: 28, name: 'Cursor' }
] as const;

export const TICKER_VIDEOS = [
  'liquid-glass-1x1.MP4',
  'masking-loop-v3.MP4',
  'feega-showcase-v2.mp4',
  'demo-v2.MP4',
  'ui-morph-v2.mp4',
  'launch.MP4',
  '2-dark-pill-chips.mp4',
  'ui-ring-farm.MP4',
  'sting-loop-1x1.mp4',
  'scroll-story-default.mp4',
  'poster-liquid-glass-4x5.MP4',
  'draft-wide.mp4',
  'phone-chat-1x1-720.MP4',
  'split-headline-16x9.mp4',
  'preview-wide.mp4',
  'feature-scroll-dark-centred-16x9.mp4',
  'melting-type-poster-4x5.MP4',
  'floating-media-default.mp4',
  'ring-through-title-16x9.MP4',
  'media-cloud-white-16x9-720p.MP4'
].map((file) => `${VIDEO_BASE}/${file}`);

export const FAQ = [
  {
    q: "What is Feega?",
    a: `A free tool that runs as a VS Code extension, or in your browser with npx feega. Click any element of your running app, edit it like in Figma, and the change is written to your code. No AI inside, no credits, every edit shown as a diff. The code is on <a href="${GITHUB_URL}">GitHub</a>.`
  },
  {
    q: "Can I use Feega for free?",
    a: freeAnswer()
  },
  {
    q: "Which editors and frameworks does it support?",
    a: "VS Code, Cursor, Windsurf and VSCodium, or any terminal with npx feega. React, Next.js, SvelteKit, Vue, Nuxt, React Router, Astro and Vite, styled with Tailwind or plain CSS."
  },
  {
    q: "Does it need an AI agent?",
    a: "No. Feega works without agents. There are no models and no credits. Your edits are written to your code deterministically, and you review every change as a diff."
  },
  {
    q: "What is Feega Cloud?",
    a: "Coming soon: GitHub sync, collaboration, sections and templates. The extension stays free."
  },
  {
    q: "Who owns my work, and is it used to train AI?",
    a: 'You keep your content; we never train AI on it. Details are in our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.'
  }
] as const;
