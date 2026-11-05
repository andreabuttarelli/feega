export enum Feature {
  DesignCanvas = 'designCanvas',
  KeyframeTimeline = 'keyframeTimeline',
  AiGeneration = 'aiGeneration',
  AgentEditing = 'agentEditing',
  FigmaImport = 'figmaImport',
  LottieExport = 'lottieExport',
  VideoExport = 'videoExport',
  InteractiveRuntime = 'interactiveRuntime',
  VideoAsCode = 'videoAsCode',
  OpenSource = 'openSource',
  WorksLocally = 'worksLocally',
  RealtimeCollaboration = 'realtimeCollaboration'
}

export const FEATURE_LABELS: Readonly<Record<Feature, string>> = {
  [Feature.DesignCanvas]: 'Design frames on an infinite canvas',
  [Feature.KeyframeTimeline]: 'Keyframe timeline',
  [Feature.AiGeneration]: 'Text-to-image and text-to-video inside the editor',
  [Feature.AgentEditing]: 'An AI agent (Claude Code, Codex) can build and edit the video',
  [Feature.FigmaImport]: 'Bring designs in from Figma',
  [Feature.LottieExport]: 'Lottie export',
  [Feature.VideoExport]: 'Video export (MP4, MOV or WebM)',
  [Feature.InteractiveRuntime]: 'Interactive runtime for apps and games (state machines)',
  [Feature.VideoAsCode]: 'Videos written as React code',
  [Feature.OpenSource]: 'Open-source editor (OSI licence)',
  [Feature.WorksLocally]: 'Works on your machine without an account',
  [Feature.RealtimeCollaboration]: 'Real-time collaboration on the same file'
};

export type Verdict = { readonly has: boolean; readonly note?: string };

export type FeatureTable = Readonly<Record<Feature, Verdict>>;
