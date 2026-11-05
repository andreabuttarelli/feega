import { Feature } from '../features';
import type { Competitor } from '../tool';

export const FIGMA: Competitor = {
  name: 'Figma',
  title: 'Feega vs Figma: design that animates in the same file (2026)',
  description: 'Figma designs stop at export. In Feega the same frame animates and exports to MP4, GIF or Lottie. Features, pricing, and when Figma still wins.',
  heading: 'Feega vs Figma',
  intro:
    'Your Figma designs stop at the export. In Feega, the same frame animates: paste your frames, add keyframes, export MP4, GIF or Lottie. No handoff to After Effects or Jitter.',
  pricing: 'Starter free; Professional $16 per Full seat per month; Organization $55 and Enterprise $90, billed annually.',
  features: {
    [Feature.DesignCanvas]: { has: true },
    [Feature.KeyframeTimeline]: { has: true, note: 'Figma Motion, in beta' },
    [Feature.AiGeneration]: { has: true, note: 'AI credits included per seat' },
    [Feature.AgentEditing]: { has: true, note: 'MCP server with Dev Mode, paid plans' },
    [Feature.FigmaImport]: { has: true },
    [Feature.LottieExport]: { has: false },
    [Feature.VideoExport]: { has: false },
    [Feature.InteractiveRuntime]: { has: false, note: 'Click-through prototypes' },
    [Feature.VideoAsCode]: { has: false },
    [Feature.OpenSource]: { has: false },
    [Feature.WorksLocally]: { has: false, note: 'Needs a Figma account' },
    [Feature.RealtimeCollaboration]: { has: true }
  },
  theyWin: [
    'Product UI design with a large team, handed off to developers in Dev Mode.',
    'A large plugin library and shared team libraries. Feega’s ecosystem is small.',
    'A mature, proven tool today. Feega is early-stage.'
  ],
  feegaWins: [
    'Paste from Figma and keep every layer, so you animate in seconds instead of rebuilding.',
    'Keyframes and easing live on a timeline, right on the frame you designed.',
    'Frames line up as scenes and export as one MP4, GIF or Lottie; a missing shot can be generated on the same canvas.'
  ],
  pickThem: 'Pick Figma for product UI design with a team, developer handoff and a large plugin ecosystem.',
  pickFeega: 'Pick Feega when the frame has to move: animate the layers you designed and export video or Lottie, without a second app.',
  sections: [
    {
      heading: 'One file instead of three apps',
      html: '<p>The usual way: design the frame in Figma, export the layers, rebuild them in After Effects or Jitter, and repeat for every design change.</p><p>With Feega: design or paste the frame, add keyframes to the same layers, export MP4, GIF or Lottie. Change the design and the animation follows.</p>'
    },
    {
      heading: 'Do I have to leave Figma?',
      html: '<p>No. Many people keep Figma for UI work and paste frames into Feega when they need motion. Pasted frames keep their layers, so you can edit and animate them.</p>'
    },
    {
      heading: 'Move a design over in 3 steps',
      html: '<p>Open feega.app, or run <code>npx feega</code> to work locally. Copy your frames in Figma and paste them on the canvas. Add keyframes, then export MP4, GIF or Lottie.</p>'
    }
  ],
  sources: [{ label: 'Figma pricing', href: 'https://www.figma.com/pricing/' }],
  checked: '2026-10-28'
};
