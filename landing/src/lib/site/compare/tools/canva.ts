import { Feature } from '../features';
import type { Competitor } from '../tool';

export const CANVA: Competitor = {
  name: 'Canva',
  title: 'Feega vs Canva: open-source design and motion canvas (2026)',
  description: 'Feega vs Canva: templates, AI, motion, export and pricing as of October 2026. When an open-source canvas beats a template editor, and when it doesn’t.',
  heading: 'Feega vs Canva',
  intro:
    'Canva is a template-first design tool for everyone, with a huge template library, brand kits and AI tools across web, desktop and mobile. Feega is an open-source canvas for design, timeline motion and AI generation, aimed at people who want precise control.',
  pricing: 'Free: $0 per year for one person. Pro: $144 per year for one person. Business: $250 per year for one person. Enterprise: contact sales.',
  features: {
    [Feature.DesignCanvas]: { has: true, note: 'Drag-and-drop editor, brand kits' },
    [Feature.KeyframeTimeline]: { has: false },
    [Feature.AiGeneration]: { has: true, note: 'Canva AI on all plans' },
    [Feature.AgentEditing]: { has: false, note: 'Not verified' },
    [Feature.FigmaImport]: { has: false },
    [Feature.LottieExport]: { has: false },
    [Feature.VideoExport]: { has: true },
    [Feature.InteractiveRuntime]: { has: false },
    [Feature.VideoAsCode]: { has: false },
    [Feature.OpenSource]: { has: false },
    [Feature.WorksLocally]: { has: false, note: 'Canva Offline listed on plans' },
    [Feature.RealtimeCollaboration]: { has: true }
  },
  theyWin: [
    'Templates that get results in minutes, with a library of 2M+ designs.',
    'Built for non-designers making most of the content.',
    'Native desktop and mobile apps today, brand kits and a large app ecosystem.'
  ],
  feegaWins: [
    'A timeline with keyframes and easing, exported to MP4, GIF, APNG or Lottie.',
    'Open source, with a local version and no account.',
    'Real vectors, Figma paste with layers kept, and agents that edit over MCP.'
  ],
  pickThem: 'Pick Canva for speed with templates and non-designers.',
  pickFeega: 'Pick Feega for keyframed motion, vector export and AI nodes you control.',
  sections: [
    {
      heading: 'Switching from Canva',
      html: '<p>Export your Canva designs as images or PDF and place them on the Feega canvas, or rebuild key frames in Feega to animate them. If your source files are in Figma, paste them into Feega directly with layers kept.</p>'
    },
    {
      heading: 'Does Feega have templates or run on mobile?',
      html: '<p>Not a large template library like Canva’s. Feega runs in the browser; native mobile apps are in preview and not in app stores.</p>'
    }
  ],
  sources: [{ label: 'Canva pricing', href: 'https://www.canva.com/pricing/' }],
  checked: '2026-10-28'
};
