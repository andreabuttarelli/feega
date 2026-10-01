export enum OnboardingStatus {
  Active = 'active',
  Dismissed = 'dismissed',
  Completed = 'completed'
}

export enum CoachStep {
  AddText = 'add_text',
  AddImage = 'add_image',
  AddVideo = 'add_video',
  Run = 'run',
  Generate = 'generate'
}

export const ONBOARDING_EVENT = {
  started: 'onboarding_started',
  stepCompleted: 'onboarding_step_completed',
  dismissed: 'onboarding_dismissed',
  completed: 'onboarding_completed',
  firstRealGeneration: 'first_real_generation'
} as const;

export type CoachNode = { id: string; type: string; example: boolean };
export type CoachGraph = { nodes: CoachNode[]; edges: { source: string; target: string }[] };
export type CoachChain = { text?: string; image?: string; video?: string };

export function isOnboardingStatus(value: unknown): value is OnboardingStatus {
  return Object.values(OnboardingStatus).includes(value as OnboardingStatus);
}

function downstream(graph: CoachGraph, from: string | undefined, type: string): string | undefined {
  if (!from) {
    return undefined;
  }
  const targets = new Set(graph.edges.filter((e) => e.source === from).map((e) => e.target));
  return graph.nodes.find((n) => n.type === type && targets.has(n.id))?.id;
}

export function chainOf(graph: CoachGraph): CoachChain {
  const texts = graph.nodes.filter((n) => n.type === 'text');
  const chains = texts.map((t) => {
    const image = downstream(graph, t.id, 'image');
    return { text: t.id, image, video: downstream(graph, image, 'video') };
  });
  const depth = (c: CoachChain) => [c.text, c.image, c.video].filter(Boolean).length;
  return chains.sort((a, b) => depth(b) - depth(a))[0] ?? {};
}

export function stepOf(graph: CoachGraph): CoachStep {
  const chain = chainOf(graph);
  if (!chain.text) {
    return CoachStep.AddText;
  }
  if (!chain.image) {
    return CoachStep.AddImage;
  }
  if (!chain.video) {
    return CoachStep.AddVideo;
  }

  const ids = [chain.text, chain.image, chain.video];
  const shown = graph.nodes.filter((n) => ids.includes(n.id)).every((n) => n.example);
  return shown ? CoachStep.Generate : CoachStep.Run;
}

export type Eligibility = { status: string | null; signupCampaign: string | null; nodeCount: number; hasGenerated: boolean };

export function shouldStart(who: Eligibility): boolean {
  return who.status === null && who.signupCampaign === null && who.nodeCount === 0 && !who.hasGenerated;
}

export function coachVisible(who: { status: string | null; hasGenerated: boolean }): boolean {
  return who.status === OnboardingStatus.Active && !who.hasGenerated;
}
