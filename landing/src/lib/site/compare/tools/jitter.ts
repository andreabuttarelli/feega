import { Feature } from '../features';
import type { Competitor } from '../tool';

export const JITTER: Competitor = {
  name: 'Jitter',
  title: 'Jitter alternative for AI agents: Feega vs Jitter',
  description: 'Jitter alternative for AI agents and Lottie export: Feega is open source, designs and generates with AI, and runs locally. Where Jitter still wins.',
  heading: 'Feega vs Jitter',
  intro:
    'Feega is a Jitter alternative for AI agents: an open-source canvas that puts design, a keyframe timeline and AI generation in one file, exports Lottie, and lets Claude Code edit it over MCP. Jitter offers a simple timeline, Figma import and polished presets; the differences are who drives the work.',
  pricing:
    'Free plan with a watermark, 720p and 30 fps exports. Paid plans (Pro, Max, Ultra) are billed per editor and add higher resolution, ProRes, WebM, transparent and batch export.',
  features: {
    [Feature.DesignCanvas]: { has: true },
    [Feature.KeyframeTimeline]: { has: true },
    [Feature.AiGeneration]: { has: true, note: 'AI credits, Image to Video on Pro' },
    [Feature.AgentEditing]: { has: false, note: 'No public MCP server or CLI found' },
    [Feature.FigmaImport]: { has: true },
    [Feature.LottieExport]: { has: true },
    [Feature.VideoExport]: { has: true, note: 'ProRes from Pro' },
    [Feature.InteractiveRuntime]: { has: false },
    [Feature.VideoAsCode]: { has: false },
    [Feature.OpenSource]: { has: false },
    [Feature.WorksLocally]: { has: false },
    [Feature.RealtimeCollaboration]: { has: true }
  },
  theyWin: [
    'A shorter learning curve: the timeline and presets are tuned for people coming straight from Figma.',
    'A large library of ready-made templates and animation presets.',
    'A mature product with a big community of motion designers sharing files.'
  ],
  feegaWins: [
    'An AI agent can build and change the animation through the MCP server or CLI, one typed edit at a time.',
    'Open source under Apache-2.0, and it runs locally from one file with no account.',
    'Image, video and audio generation sit on the same canvas as the frames you animate.'
  ],
  pickThem:
    'Pick Jitter if you are a designer who wants to animate Figma frames quickly by hand, with presets and templates, and you do not need an agent or a local file.',
  pickFeega:
    'Pick Feega if you want an AI agent to do part of the work, want to own the file and the code, or need generated media and motion in the same place.',
  sections: [
    {
      heading: 'How the work gets done',
      html: '<p>In Jitter you animate by hand: select a layer, add an animation, adjust the timing. It is fast for that, and the presets cover most product and social animations.</p><p>In Feega you can do the same by hand, or ask Claude Code or Codex to do it. The agent edits the same document you see, so you can take over at any point and nudge a keyframe yourself.</p>'
    },
    {
      heading: 'Exports',
      html: '<p>Both export video, GIF and Lottie. Jitter keeps ProRes, WebM and transparent video for paid plans. Feega exports MP4, ProRes 422 and 4444, WebM with alpha, GIF, APNG and Lottie from the same panel.</p>'
    }
  ],
  sources: [
    { label: 'Jitter pricing', href: 'https://jitter.video/pricing/' }
  ],
  checked: '2026-11-04'
};
