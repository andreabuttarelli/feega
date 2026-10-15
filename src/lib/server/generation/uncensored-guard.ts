import { ProjectMode } from '$lib/project-mode';

export const UNCENSORED_REFUSALS = {
  project: 'uncensored_requires_uncensored_project',
  disabled: 'Uncensored models are off for this workspace. The owner can turn them on in Settings.',
  inputs: "Uncensored models don't accept references: remove every incoming connection and reference first."
} as const;

export type GuardFacts = { uncensored: boolean; mode: ProjectMode; carriesInputs: boolean; accessAllowed: boolean };

const UNCENSORED_RULES: ReadonlyArray<{ refusal: string; breaks: (facts: GuardFacts) => boolean }> = [
  { refusal: UNCENSORED_REFUSALS.project, breaks: (facts) => facts.mode !== ProjectMode.Uncensored },
  { refusal: UNCENSORED_REFUSALS.disabled, breaks: (facts) => !facts.accessAllowed },
  { refusal: UNCENSORED_REFUSALS.inputs, breaks: (facts) => facts.carriesInputs }
];

export function uncensoredRefusal(facts: GuardFacts): string | null {
  if (!facts.uncensored) {
    return null;
  }
  return UNCENSORED_RULES.find((rule) => rule.breaks(facts))?.refusal ?? null;
}
