import { Feature } from '../features';
import type { Competitor } from '../tool';

export const GUI: Competitor = {
  name: 'Gui',
  title: 'Feega vs Gui (usegui.com): visual app editing',
  description: 'Feega vs Gui: live app editing, bring-your-own agent, code import, Figma import, motion and pricing as of November 2026.',
  heading: 'Feega vs Gui',
  intro:
    'Gui is an open-source Mac app that runs your dev server, lets you select an element of the live app and has your own coding agent edit the source. Feega is an open-source canvas for design, motion and prototypes that imports your app as editable frames and sends style changes back as a GitHub pull request.',
  pricing: 'Free and open source (Apache-2.0). Mac with Apple silicon, in alpha; Windows and Linux on a waitlist. No built-in AI: you bring your own agent and pay its provider.',
  features: {
    [Feature.DesignCanvas]: { has: true, note: 'Canvas of HTML frames' },
    [Feature.KeyframeTimeline]: { has: false },
    [Feature.AiGeneration]: { has: false, note: 'No built-in AI' },
    [Feature.AgentEditing]: { has: true, note: 'Your agent over ACP: Claude Code, Codex, Gemini CLI, Cursor and others' },
    [Feature.FigmaImport]: { has: false },
    [Feature.LottieExport]: { has: false },
    [Feature.VideoExport]: { has: false, note: 'PNG export' },
    [Feature.InteractiveRuntime]: { has: false, note: 'Runs your real app instead' },
    [Feature.VideoAsCode]: { has: false },
    [Feature.OpenSource]: { has: true, note: 'Apache-2.0' },
    [Feature.WorksLocally]: { has: true, note: 'Native Mac app' },
    [Feature.RealtimeCollaboration]: { has: false, note: 'Not stated' }
  },
  theyWin: [
    'Edits the running app itself: select an element, describe the change, your agent edits the source.',
    'Bring your own agent over ACP, with no AI cost from Gui.',
    'A native Mac app, free and open source.'
  ],
  feegaWins: [
    'Imports Next.js, Vite, Vue and Svelte apps, Storybook, Figma files and live URLs as editable frames.',
    'Designs animate and export to MP4, GIF or Lottie, next to clickable prototypes.',
    'A built-in agent plus an MCP server, in the browser or locally with npx feega.'
  ],
  pickThem: 'Pick Gui to tweak a running React or Astro app on a Mac with the agent you already pay for.',
  pickFeega: 'Pick Feega to design, animate or prototype from your app, Figma or a URL, on any OS.',
  sections: [
    {
      heading: 'Live app or imported frames',
      html: '<p>Gui shows your app running and maps elements back to source for React (Vite, Next.js) and Astro; Vue and Svelte are not supported yet. Feega starts your Next.js or Vite dev server, captures the pages as frames with their components (React, Vue, Svelte), and writes class and style changes back to the repository as a pull request.</p>'
    },
    {
      heading: 'Who pays for the AI',
      html: '<p>Gui has no AI of its own: it drives the agent you already have. Feega has a built-in agent billed in credits, and external agents can connect to its MCP server.</p>'
    }
  ],
  faq: [
    { q: 'Is Gui open source?', a: 'Yes, Apache-2.0, at github.com/brijr/gui. So is Feega.' },
    { q: 'Does Gui import Figma?', a: 'No. Feega imports Figma by paste or by link.' }
  ],
  sources: [
    { label: 'usegui.com', href: 'https://usegui.com' },
    { label: 'Gui on GitHub', href: 'https://github.com/brijr/gui' }
  ],
  checked: '2026-11-11'
};
