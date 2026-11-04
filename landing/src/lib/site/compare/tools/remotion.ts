import { Feature } from '../features';
import type { Competitor } from '../tool';

export const REMOTION: Competitor = {
  name: 'Remotion',
  title: 'Feega vs Remotion: videos as code or as a canvas',
  description: 'Remotion writes videos in React; Feega edits them on a canvas an AI agent can drive. Where each fits, with a feature table.',
  heading: 'Feega vs Remotion',
  intro:
    'Remotion lets developers write videos as React components and render them programmatically. Feega stores a video as a document of tracks, clips and properties that you edit on a canvas, or that an AI agent edits through typed operations. Both work with Claude Code; they disagree on what the agent should write.',
  pricing:
    'Free for individuals, non-profits and companies of up to three people. Larger companies need a Company License, billed by usage; enterprise plans start at a monthly minimum.',
  features: {
    [Feature.DesignCanvas]: { has: false },
    [Feature.KeyframeTimeline]: { has: false, note: 'Animation is written in code' },
    [Feature.AiGeneration]: { has: false },
    [Feature.AgentEditing]: { has: true, note: 'Official Agent Skills for Claude Code' },
    [Feature.FigmaImport]: { has: false },
    [Feature.LottieExport]: { has: false, note: 'Can play Lottie, not export it' },
    [Feature.VideoExport]: { has: true },
    [Feature.InteractiveRuntime]: { has: false },
    [Feature.VideoAsCode]: { has: true },
    [Feature.OpenSource]: { has: false, note: 'Source available, own licence' },
    [Feature.WorksLocally]: { has: true },
    [Feature.RealtimeCollaboration]: { has: false }
  },
  theyWin: [
    'Data-driven video at scale: thousands of personalised renders from one React template.',
    'Anything React and the web can draw is available, with the npm ecosystem behind it.',
    'Server and serverless rendering that is battle-tested in production.'
  ],
  feegaWins: [
    'A small change is a small edit: moving a title is one property change, not a code change.',
    'Designers and non-developers can open the same file and edit it by hand.',
    'Design frames, Figma import and AI image and video generation live next to the animation.'
  ],
  pickThem:
    'Pick Remotion if you are a developer building a video pipeline in code, especially templated or personalised video rendered in bulk.',
  pickFeega:
    'Pick Feega if you want an agent and a person to work on the same video, see every change on a canvas, and keep editing without touching code.',
  sections: [
    {
      heading: 'What the agent writes',
      html: '<p>With Remotion, Claude Code writes and rewrites React components. That is flexible, and every fix is a code change you review as code.</p><p>With Feega, the agent sends typed edits to the document: add a clip, set a property, change an easing. The same edits are what you make by hand, so you can switch between the two at any moment.</p>'
    },
    {
      heading: 'Licensing',
      html: '<p>Feega is Apache-2.0 open source. Remotion is source available: free for small teams, paid for companies of four or more people.</p>'
    }
  ],
  sources: [
    { label: 'Remotion license FAQ', href: 'https://www.remotion.dev/docs/license/faq' },
    { label: 'Remotion pricing', href: 'https://www.remotion.dev/docs/license/pricing' },
    { label: 'Remotion Agent Skills', href: 'https://www.remotion.dev/docs/ai/skills' }
  ],
  checked: '2026-11-04'
};
