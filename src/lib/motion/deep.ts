export enum TurnMode {
  Quick = 'quick',
  Deep = 'deep'
}

export enum DeepPhase {
  Storyboard = 'storyboard',
  Assets = 'assets',
  Build = 'build',
  Render = 'render',
  Critique = 'critique',
  Summary = 'summary',
  Done = 'done'
}

export const DEEP_PHASE_LABEL: Record<DeepPhase, string> = {
  [DeepPhase.Storyboard]: 'Storyboard',
  [DeepPhase.Assets]: 'Preparing assets',
  [DeepPhase.Build]: 'Building',
  [DeepPhase.Render]: 'Rendering frames',
  [DeepPhase.Critique]: 'Critique',
  [DeepPhase.Summary]: 'Wrapping up',
  [DeepPhase.Done]: 'Done'
};

export enum DeepEnd {
  Finished = 'finished',
  Stopped = 'stopped',
  Paused = 'paused',
  Failed = 'failed'
}

export type DeepNote = { phase: DeepPhase; iteration: number; text: string; at: string };

export type DeepVerdict = { pass: boolean; score: number; fixes: string[] };

export type DeepState = {
  phase: DeepPhase;
  iteration: number;
  storyboard: string | null;
  verdict: DeepVerdict | null;
  best?: { verdict: DeepVerdict; version: number } | null;
  notes: DeepNote[];
  summary: string | null;
};

export const DEEP_QUOTE = 'data-motion-deep-quote';

export type DeepQuote = { message: string; model: string; reasoning: string | null; credits: number; capCredits: number; minutes: number; iterations: number };

export type DeepView = {
  runId: string;
  status: 'running' | 'finishing' | 'done' | 'failed' | 'expired';
  phase: DeepPhase;
  iteration: number;
  maxIterations: number;
  notes: DeepNote[];
  verdict: DeepVerdict | null;
  quoteCredits: number;
  capCredits: number;
  spentCredits: number;
  stopping: boolean;
  summary: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};
