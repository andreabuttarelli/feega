import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Onboarding } from '../messages';

export type OnboardingStore = {
  read: () => Promise<Onboarding>;
  markSeen: () => Promise<unknown>;
};

const GLOBAL_KEY = 'feegaInspect.onboarded';
const ONBOARDING_FILE = join('.config', 'feega', 'onboarding.json');

export const onboardingPath = (home: string = homedir()) => join(home, ONBOARDING_FILE);

export const memoryOnboardingStore = (): OnboardingStore => {
  let seen = Onboarding.Pending;
  return { read: async () => seen, markSeen: async () => void (seen = Onboarding.Seen) };
};

export const globalStateOnboardingStore = (state: { get: (key: string) => unknown; update: (key: string, value: unknown) => PromiseLike<unknown> }): OnboardingStore => ({
  read: async () => (state.get(GLOBAL_KEY) === Onboarding.Seen ? Onboarding.Seen : Onboarding.Pending),
  markSeen: () => Promise.resolve(state.update(GLOBAL_KEY, Onboarding.Seen))
});

export const fileOnboardingStore = (path: string = onboardingPath()): OnboardingStore => ({
  read: async () => {
    try {
      return JSON.parse(readFileSync(path, 'utf8')).seen === Onboarding.Seen ? Onboarding.Seen : Onboarding.Pending;
    } catch {
      return Onboarding.Pending;
    }
  },
  markSeen: async () => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ seen: Onboarding.Seen }));
  }
});
