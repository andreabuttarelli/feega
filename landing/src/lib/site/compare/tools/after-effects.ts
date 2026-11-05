import { Feature } from '../features';
import type { Competitor } from '../tool';

export const AFTER_EFFECTS: Competitor = {
  name: 'After Effects',
  title: 'Feega vs After Effects: when each one fits',
  description: 'After Effects is the professional standard for motion and VFX. Feega is an open canvas for design, motion and AI agents. A fair comparison.',
  heading: 'Feega vs After Effects',
  intro:
    'After Effects is the industry standard for motion graphics, compositing and visual effects, with decades of plugins and tutorials behind it. Feega is a browser canvas for design and motion that an AI agent can edit. Most After Effects work is out of Feega’s scope; the overlap is product, UI and social motion.',
  pricing: 'Single-app subscription on an annual plan, billed monthly, as part of Creative Cloud.',
  features: {
    [Feature.DesignCanvas]: { has: false },
    [Feature.KeyframeTimeline]: { has: true },
    [Feature.AiGeneration]: { has: false, note: 'AI tools focus on masking and rotoscoping' },
    [Feature.AgentEditing]: { has: false, note: 'Scripting, no official agent integration' },
    [Feature.FigmaImport]: { has: false, note: 'Third-party plugins' },
    [Feature.LottieExport]: { has: false, note: 'Through the third-party Bodymovin plugin' },
    [Feature.VideoExport]: { has: true },
    [Feature.InteractiveRuntime]: { has: false },
    [Feature.VideoAsCode]: { has: false },
    [Feature.OpenSource]: { has: false },
    [Feature.WorksLocally]: { has: true, note: 'Desktop app, Adobe account required' },
    [Feature.RealtimeCollaboration]: { has: false, note: 'Review through Frame.io' }
  },
  theyWin: [
    'Compositing, tracking, rotoscoping, 3D and visual effects that Feega does not attempt.',
    'Expressions, scripting and a plugin ecosystem built over decades.',
    'It is what studios hire for: files, templates and skills move between teams.'
  ],
  feegaWins: [
    'An AI agent can build and edit the animation for you through the MCP server and CLI.',
    'It runs in the browser or locally from one file, with no install and no account for local use.',
    'Design frames, Figma import and AI-generated media sit on the same canvas as the timeline.'
  ],
  pickThem:
    'Pick After Effects for VFX, compositing, character animation or any work that has to match a studio pipeline.',
  pickFeega:
    'Pick Feega for product videos, UI animation and social motion where speed, an agent and a shared canvas matter more than effects depth.',
  sections: [
    {
      heading: 'Depth versus speed',
      html: '<p>After Effects can do almost anything, and most of it takes skill and time. Feega covers a narrower set, layout, text, shapes, images, video clips and keyframes, so a person or an agent can produce a finished product video quickly.</p>'
    },
    {
      heading: 'Moving between them',
      html: '<p>Feega exports ProRes 4444 and WebM with alpha, so a Feega animation can be dropped into an After Effects or video editing project as a layer.</p>'
    }
  ],
  sources: [
    { label: 'After Effects plans', href: 'https://www.adobe.com/products/aftereffects/plans.html' },
    { label: 'Adobe at Sundance 2026', href: 'https://www.webpronews.com/adobes-ai-surge-at-sundance-premiere-and-after-effects-reshape-post-production' }
  ],
  checked: '2026-11-04'
};
