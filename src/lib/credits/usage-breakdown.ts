import { billedCreditsFor } from '$lib/credit-ladder';

export enum UsageKind {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Agent = 'agent',
  Chat = 'chat'
}

export type UsageCall = {
  operation: string;
  actor_kind: string;
  project_id: string | null;
  billed_credits: number | null;
  cost_usd: number | null;
};

export type ProjectName = { id: string; name: string };

export type ProjectUsage = { id: string | null; name: string | null; credits: number };

export type KindUsage = { kind: UsageKind; credits: number; calls: number };

export type UsageBreakdown = { total: number; byProject: ProjectUsage[]; byKind: KindUsage[] };

const AUDIO_OPERATIONS = ['music', 'text_to_speech', 'sound_effects', 'dubbing', 'voice_changer', 'voice_isolation'];

const KIND_RULES: { kind: UsageKind; matches: (call: UsageCall, label: string) => boolean }[] = [
  { kind: UsageKind.Image, matches: (_, label) => label === 'renderImage' || label === 'image' },
  { kind: UsageKind.Video, matches: (_, label) => label === 'video' },
  { kind: UsageKind.Audio, matches: (_, label) => AUDIO_OPERATIONS.includes(label) },
  { kind: UsageKind.Agent, matches: (call) => call.actor_kind === 'agent' },
  { kind: UsageKind.Chat, matches: () => true }
];

const kindOf = (call: UsageCall): UsageKind => {
  const label = call.operation.split(':')[0];
  return KIND_RULES.find((rule) => rule.matches(call, label))!.kind;
};

const creditsOf = (call: UsageCall): number => call.billed_credits ?? billedCreditsFor(call.cost_usd ?? 0);

const biggestFirst = <T extends { credits: number }>(rows: T[]): T[] => rows.filter((r) => r.credits > 0).sort((a, b) => b.credits - a.credits);

export function usageBreakdown(calls: UsageCall[], projects: ProjectName[]): UsageBreakdown {
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const perProject = new Map<string | null, ProjectUsage>();
  const perKind = new Map<UsageKind, KindUsage>();
  let total = 0;

  for (const call of calls) {
    const credits = creditsOf(call);
    total += credits;

    const project = perProject.get(call.project_id) ?? { id: call.project_id, name: call.project_id ? (names.get(call.project_id) ?? null) : null, credits: 0 };
    project.credits += credits;
    perProject.set(call.project_id, project);

    const kind = kindOf(call);
    const bucket = perKind.get(kind) ?? { kind, credits: 0, calls: 0 };
    bucket.credits += credits;
    bucket.calls += 1;
    perKind.set(kind, bucket);
  }

  return { total, byProject: biggestFirst([...perProject.values()]), byKind: biggestFirst([...perKind.values()]) };
}
