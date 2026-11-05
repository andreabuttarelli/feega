import { Feature } from '../features';
import type { Competitor } from '../tool';

export const PENCIL_DEV: Competitor = {
  name: 'Pencil.dev',
  title: 'Feega vs Pencil.dev (pen.dev): agentic design canvases',
  description: 'Feega vs Pencil.dev, now pen.dev: AI agents, MCP, Figma import, export and pricing as of October 2026. Where each canvas fits.',
  heading: 'Feega vs Pencil.dev',
  intro:
    'Pencil.dev, now pen.dev, is an agentic design canvas that lives next to your code, with IDE extensions and HTML/Tailwind export. Feega is an open-source canvas for design, motion and AI media generation that agents edit over MCP.',
  pricing: 'Free: $0, 5 agent-design days per month, 25 image/SVG generations. Pro: $16 per user per month. Ultra: $48 per user per month. Enterprise: custom. Annual billing saves 20%.',
  features: {
    [Feature.DesignCanvas]: { has: true, note: 'Components, variables, flex layout, slides' },
    [Feature.KeyframeTimeline]: { has: false },
    [Feature.AiGeneration]: { has: true, note: 'Image and SVG generations per month by plan' },
    [Feature.AgentEditing]: { has: true, note: 'On-canvas agent, MCP, WebMCP, headless CLI' },
    [Feature.FigmaImport]: { has: true, note: 'Imports .fig files' },
    [Feature.LottieExport]: { has: false },
    [Feature.VideoExport]: { has: false, note: 'PDF, PNG, JPEG, WEBP, HTML and CSS/Tailwind' },
    [Feature.InteractiveRuntime]: { has: false },
    [Feature.VideoAsCode]: { has: false },
    [Feature.OpenSource]: { has: false, note: 'Open .pen file format; app license not stated' },
    [Feature.WorksLocally]: { has: false, note: 'Not verified' },
    [Feature.RealtimeCollaboration]: { has: false, note: 'Link sharing' }
  },
  theyWin: [
    'Design inside Cursor or VS Code, with HTML or Tailwind out.',
    'Live webpages pasted as layers with the Chrome extension.',
    'A design-to-code workflow rather than design-to-video.'
  ],
  feegaWins: [
    'Designs animate and export to MP4, GIF or Lottie.',
    'Images, video and audio are generated on the same canvas.',
    'The whole app is open source and self-hostable, with real-time editing and comments.'
  ],
  pickThem: 'Pick Pencil.dev for design-to-code inside your IDE.',
  pickFeega: 'Pick Feega when designs must move, export to video, or mix with generated media.',
  sections: [
    {
      heading: 'Moving designs into Feega',
      html: '<p>Feega does not open .pen files. If your source is in Figma, copy the layers and paste them on the Feega canvas; layers are kept. Agents that already speak MCP can connect to Feega’s MCP server and work on the same canvas you do.</p>'
    },
    {
      heading: 'Is Pencil.dev the same as pen.dev?',
      html: '<p>Yes. pencil.dev now redirects to pen.dev.</p>'
    },
    {
      heading: 'Can Feega export code?',
      html: '<p>Feega exports images, vectors and video (PNG, SVG, PDF, MP4, GIF, APNG, Lottie), not HTML or Tailwind.</p>'
    }
  ],
  sources: [
    { label: 'pen.dev pricing', href: 'https://pen.dev/pricing' },
    { label: 'pen.dev', href: 'https://pen.dev' }
  ],
  checked: '2026-10-28'
};
