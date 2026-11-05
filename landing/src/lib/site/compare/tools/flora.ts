import { Feature } from '../features';
import type { Competitor } from '../tool';

export const FLORA: Competitor = {
  name: 'Flora',
  title: 'Feega vs Flora: AI creative canvases compared (2026)',
  description: 'Feega vs Flora: AI models, workflows, MCP, design and motion tools, and pricing as of October 2026. Open source vs hosted AI canvas.',
  heading: 'Feega vs Flora',
  intro:
    'Flora is a hosted AI creative canvas that runs many image, video and 3D models in one place, with saved workflows for teams. Feega is an open-source canvas where AI nodes sit next to real design and motion tools, on your own provider keys.',
  pricing: 'Free: $0, 1 seat, 3 active projects. Starter: $18 per seat per month. Pro: $50 per seat per month. Max: $200 per seat per month. Enterprise: custom, teams of 9+.',
  features: {
    [Feature.DesignCanvas]: { has: false, note: 'Node canvas for generations' },
    [Feature.KeyframeTimeline]: { has: false },
    [Feature.AiGeneration]: { has: true, note: 'Hosted catalog: Veo, Kling, Seedance, GPT Image, FLUX and 60+ others' },
    [Feature.AgentEditing]: { has: true, note: 'MCP for Claude, ChatGPT, Codex, Cursor' },
    [Feature.FigmaImport]: { has: false },
    [Feature.LottieExport]: { has: false },
    [Feature.VideoExport]: { has: true, note: 'Generated clips' },
    [Feature.InteractiveRuntime]: { has: false },
    [Feature.VideoAsCode]: { has: false },
    [Feature.OpenSource]: { has: false },
    [Feature.WorksLocally]: { has: false, note: 'Web app' },
    [Feature.RealtimeCollaboration]: { has: true, note: 'Starter and up' }
  },
  theyWin: [
    'Many hosted models without managing keys.',
    'Team usage caps and usage analytics, plus Decks and Studios for presenting work.',
    'A mature hosted product. Feega is early-stage.'
  ],
  feegaWins: [
    'You own the tool: open source, self-hosted or local.',
    'You bring your own API keys instead of buying usage.',
    'Generated images and video go into designed, animated frames exported to MP4, GIF, Lottie, SVG or PDF.'
  ],
  pickThem: 'Pick Flora for a curated, hosted model catalog with no keys to manage.',
  pickFeega: 'Pick Feega when generated media must become a designed, animated, exported piece.',
  sections: [
    {
      heading: 'Switching from Flora',
      html: '<p>Download your generated images and video from Flora and drop them on the Feega canvas, or regenerate them in Feega’s AI nodes with your own keys. Agents connected over MCP can rebuild a workflow as connected nodes.</p>'
    },
    {
      heading: 'Which AI models does Feega use?',
      html: '<p>Models from the providers you connect with your own keys: Kie.ai, OpenRouter, Higgsfield, Wiro, ElevenLabs and a text LLM provider.</p>'
    }
  ],
  sources: [
    { label: 'Flora pricing', href: 'https://flora.ai/pricing' },
    { label: 'Flora docs', href: 'https://docs.flora.ai' }
  ],
  checked: '2026-10-28'
};
