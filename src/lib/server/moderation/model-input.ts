import { createHash } from 'node:crypto';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { ModerationProfile } from './profiles';
import { screenGeneration, type ScreenOutcome, type ScreenPorts } from './screen';
import { screenReferences, type PeopleDetector, type Reference } from './people';
import type { ProjectMode } from '$lib/project-mode';

export const SCREEN_CACHE_TTL_MS = 10 * 60_000;
const SCREEN_CACHE_MAX_ENTRIES = 2000;
const CLEAR: ScreenOutcome = { ok: true };

export type ModelInputScope = {
  orgId: string;
  userId: string;
  projectId?: string | null;
  nodeId?: string | null;
  model?: string | null;
  actor?: Actor;
};

export type ModelInput = {
  profile: ModerationProfile;
  texts: ReadonlyArray<string | null | undefined>;
  scope: ModelInputScope;
};

const verdicts = new Map<string, { outcome: ScreenOutcome; expiresAt: number }>();

function normalized(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cacheKey(profile: ModerationProfile, texts: string[]): string {
  return `${profile}:${createHash('sha256').update(texts.map(normalized).join('\n')).digest('hex')}`;
}

function cached(key: string): ScreenOutcome | null {
  const hit = verdicts.get(key);
  if (!hit) {
    return null;
  }
  if (hit.expiresAt <= Date.now()) {
    verdicts.delete(key);
    return null;
  }
  return hit.outcome;
}

function remember(key: string, outcome: ScreenOutcome): void {
  if (!outcome.ok && outcome.unavailable) {
    return;
  }
  if (verdicts.size >= SCREEN_CACHE_MAX_ENTRIES) {
    verdicts.delete(verdicts.keys().next().value as string);
  }
  verdicts.set(key, { outcome, expiresAt: Date.now() + SCREEN_CACHE_TTL_MS });
}

async function defaultPorts(db: Db, input: ModelInput): Promise<ScreenPorts> {
  const { moderationPorts } = await import('./moderation-config');
  return moderationPorts(db, {
    orgId: input.scope.orgId,
    userId: input.scope.userId,
    projectId: input.scope.projectId ?? null,
    nodeId: input.scope.nodeId ?? null,
    model: input.scope.model ?? null,
    actor: input.scope.actor,
    uncensored: input.profile === ModerationProfile.Uncensored
  });
}

export async function screenModelInput(db: Db, input: ModelInput, ports?: ScreenPorts): Promise<ScreenOutcome> {
  const texts = input.texts.filter((t): t is string => Boolean(t?.trim()));
  if (!texts.length) {
    return CLEAR;
  }

  const key = cacheKey(input.profile, texts);
  const hit = cached(key);
  if (hit) {
    return hit;
  }

  const outcome = await screenGeneration(ports ?? (await defaultPorts(db, input)), {
    text: texts.join('\n\n'),
    references: [],
    uncensored: input.profile === ModerationProfile.Uncensored
  });
  remember(key, outcome);
  return outcome;
}

export async function screenModelReferences(
  input: { orgId: string; mode: ProjectMode; references: readonly Reference[] },
  detect?: PeopleDetector
): Promise<ScreenOutcome> {
  const detector = detect ?? (await import('./moderation-config')).peopleDetector(input.orgId);
  return screenReferences(detector, input.mode, input.references);
}
