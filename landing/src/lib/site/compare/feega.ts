import { Feature, type FeatureTable } from './features';

export const FEEGA_PRICING =
  'Free to run locally from the open-source repository. The cloud app, with AI generation, sharing and comments, is a monthly plan; see pricing on the home page.';

export const FEEGA_FEATURES: FeatureTable = {
  [Feature.DesignCanvas]: { has: true },
  [Feature.KeyframeTimeline]: { has: true },
  [Feature.AiGeneration]: { has: true, note: 'Cloud app, models from Google, OpenAI, ByteDance and others' },
  [Feature.AgentEditing]: { has: true, note: 'MCP server, CLI and REST API' },
  [Feature.FigmaImport]: { has: true, note: 'Paste from Figma or import by link' },
  [Feature.LottieExport]: { has: true, note: 'Lottie and dotLottie' },
  [Feature.VideoExport]: { has: true, note: 'MP4 H.264/H.265, ProRes 422 and 4444, WebM with alpha, GIF' },
  [Feature.InteractiveRuntime]: { has: false, note: 'Click-through prototypes only' },
  [Feature.VideoAsCode]: { has: false },
  [Feature.OpenSource]: { has: true, note: 'Apache-2.0' },
  [Feature.WorksLocally]: { has: true, note: 'One .feega file, no account' },
  [Feature.RealtimeCollaboration]: { has: true, note: 'Cloud app' }
};
