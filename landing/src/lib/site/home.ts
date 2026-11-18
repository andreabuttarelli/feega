import { AGENT_DOCS_URL, PLAN, agentAnswer, creditsAnswer, freeAnswer, runOutAnswer, seatAnswer } from './pricing/plan';
import { GITHUB_URL } from './links';

const VIDEO_BASE = 'https://klnswzhhgrqvbfjzioul.supabase.co/storage/v1/object/public/website';

export const HERO_HEADLINE = ['Design inside your code', 'with your agents and team.'] as const;

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
    a: `An open-source (Apache-2.0) canvas for design, motion and AI generation that you and your agents work on together, in the browser or locally. The code is on <a href="${GITHUB_URL}">GitHub</a>; Google Sign-In is used only to log in, never on your content.`
  },
  {
    q: "Can I use Feega for free?",
    a: freeAnswer(PLAN)
  },
  {
    q: "Can my AI agent use Feega?",
    a: `${agentAnswer(PLAN)} See the <a href="${AGENT_DOCS_URL}">MCP guide</a>.`
  },
  {
    q: `Who counts as an ${PLAN.per}?`,
    a: seatAnswer(PLAN)
  },
  {
    q: "How do credits work?",
    a: creditsAnswer(PLAN)
  },
  {
    q: "What happens when I run out of credits?",
    a: runOutAnswer(PLAN)
  },
  {
    q: "Can I cancel?",
    a: "Yes, any time from the billing portal on your team's Credits page. Credits you bought stay yours, and other editors become viewers."
  },
  {
    q: "Who owns my work, and is it used to train AI?",
    a: 'You keep your content and may use what you generate for your business; we never train AI on it. Details are in our <a href="/terms">Terms</a>, <a href="/privacy">Privacy Policy</a>, <a href="/acceptable-use">Acceptable Use Policy</a> and <a href="/ai-transparency">AI Transparency</a>.'
  }
] as const;
