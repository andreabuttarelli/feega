import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type OnboardingState = { seenAt: string | null };

const NEVER_SEEN: OnboardingState = { seenAt: null };

const stateFile = (home: string) => join(home, '.feega', 'onboarding.json');

export async function onboardingState(home = homedir()): Promise<OnboardingState> {
  try {
    const parsed = JSON.parse(await readFile(stateFile(home), 'utf8')) as { seenAt?: unknown };
    return typeof parsed?.seenAt === 'string' ? { seenAt: parsed.seenAt } : NEVER_SEEN;
  } catch {
    return NEVER_SEEN;
  }
}

export async function markSeen(home = homedir(), now = new Date()): Promise<OnboardingState> {
  const state = { seenAt: now.toISOString() };
  const file = stateFile(home);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(state));
  return state;
}
